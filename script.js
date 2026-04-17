const authPanel = document.querySelector("#authPanel");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const userMenu = document.querySelector("#userMenu");
const userDisplay = document.querySelector("#userDisplay");
const logoutButton = document.querySelector("#logoutButton");
const workspace = document.querySelector(".workspace");
const detailPanel = document.querySelector("#detail");
const form = document.querySelector("#jobForm");
const photoInput = document.querySelector("#photos");
const photoPreview = document.querySelector("#photoPreview");
const jobList = document.querySelector("#jobList");
const searchInput = document.querySelector("#searchInput");
const filterButtons = document.querySelectorAll(".filter-button");
const detail = document.querySelector("#jobDetail");
const emptyDetail = document.querySelector("#emptyDetail");
const submitButton = document.querySelector("#submitButton");
const clearFormButton = document.querySelector("#clearFormButton");

const supabaseConfig = window.IRONPROOF_SUPABASE || {};
const supabaseClient =
  window.supabase && supabaseConfig.url && supabaseConfig.anonKey
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
    : null;

let currentUser = null;
let currentProfile = null;
let jobs = [];
let jobPhotosByJobId = new Map();
let activeFilter = "All";
let activeJobId = null;
let editingJobId = null;
let stagedPhotos = [];

setDefaultDate();
render();
initializeAuth();

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    showSupabaseSetupMessage();
    return;
  }

  const action = event.submitter?.dataset.authAction || "login";
  const formData = new FormData(authForm);
  const email = getValue(formData, "authEmail");
  const password = getValue(formData, "authPassword");
  const displayName = getValue(formData, "displayName");

  setAuthMessage(action === "signup" ? "Creating account..." : "Logging in...");

  try {
    if (action === "signup") {
      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        throw error;
      }

      setAuthMessage("Account created. If email confirmation is enabled, check your inbox before logging in.");
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }

    authForm.reset();
    setAuthMessage("");
  } catch (error) {
    setAuthMessage(error.message);
  }
});

logoutButton.addEventListener("click", async () => {
  if (!supabaseClient) {
    return;
  }

  await supabaseClient.auth.signOut();
});

photoInput.addEventListener("change", async (event) => {
  stagedPhotos = await readPhotos([...event.target.files]);
  renderPhotoPreview(stagedPhotos);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    showSupabaseSetupMessage();
    return;
  }

  if (!currentUser) {
    setAuthMessage("Log in before saving a job.");
    return;
  }

  const formData = new FormData(form);
  const payload = {
    title: getValue(formData, "title"),
    status: getValue(formData, "status") || "Open",
    work_order: getValue(formData, "workOrder"),
    job_date: getValue(formData, "jobDate") || null,
    machine: getValue(formData, "machine"),
    serial: getValue(formData, "serial"),
    customer: getValue(formData, "customer"),
    meter: getValue(formData, "meter"),
    summary: getValue(formData, "summary"),
    complaint: getValue(formData, "complaint"),
    cause: getValue(formData, "cause"),
    correction: getValue(formData, "correction"),
    parts: getValue(formData, "parts"),
    updated_by: currentUser.id,
  };

  submitButton.disabled = true;
  submitButton.textContent = editingJobId ? "Updating..." : "Saving...";

  try {
    const savedJob = editingJobId
      ? await updateJob(editingJobId, payload)
      : await createJob({ ...payload, created_by: currentUser.id });
    await uploadStagedPhotos(savedJob.id);
    activeJobId = savedJob.id;
    await loadJobs();
    resetForm();
  } catch (error) {
    alert(`Supabase save failed: ${error.message}`);
    submitButton.textContent = editingJobId ? "Update job" : "Save job";
  } finally {
    submitButton.disabled = false;
  }
});

clearFormButton.addEventListener("click", resetForm);

searchInput.addEventListener("input", renderJobList);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderJobList();
  });
});

async function initializeAuth() {
  if (!supabaseClient) {
    setSignedOutState();
    showSupabaseSetupMessage();
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    setAuthMessage(error.message);
    setSignedOutState();
    return;
  }

  await handleSession(data.session);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });
}

async function handleSession(session) {
  currentUser = session?.user || null;

  if (!currentUser) {
    setSignedOutState();
    return;
  }

  currentProfile = await loadProfile(currentUser);
  setSignedInState();
  await loadJobs();
}

function setSignedInState() {
  authPanel.classList.add("hidden");
  userMenu.classList.remove("hidden");
  workspace.classList.remove("hidden");
  detailPanel.classList.remove("hidden");
  userDisplay.textContent = currentProfile?.display_name || currentUser.email;
  setAuthMessage("");
}

function setSignedOutState() {
  currentUser = null;
  currentProfile = null;
  jobs = [];
  activeJobId = null;
  editingJobId = null;
  authPanel.classList.remove("hidden");
  userMenu.classList.add("hidden");
  workspace.classList.add("hidden");
  detailPanel.classList.add("hidden");
  resetForm();
  render();
}

async function loadProfile(user) {
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error) {
    setAuthMessage(`Profile load failed: ${error.message}`);
    return null;
  }

  if (data) {
    return data;
  }

  return createProfile(user);
}

async function createProfile(user) {
  const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "IronProof user";
  const { data, error } = await supabaseClient
    .from("profiles")
    .insert({
      id: user.id,
      display_name: displayName,
      email: user.email,
    })
    .select()
    .single();

  if (error) {
    setAuthMessage(`Profile creation failed: ${error.message}`);
    return null;
  }

  return data;
}

async function loadJobs() {
  if (!supabaseClient) {
    jobs = [];
    activeJobId = null;
    render();
    showSupabaseSetupMessage();
    return;
  }

  if (!currentUser) {
    jobs = [];
    activeJobId = null;
    render();
    return;
  }

  jobList.innerHTML = '<div class="empty-list">Loading your jobs from Supabase...</div>';

  try {
    const { data, error } = await supabaseClient
      .from("jobs")
      .select(
        "id,title,status,work_order,job_date,machine,serial,customer,meter,summary,complaint,cause,correction,parts,created_at,created_by,updated_by",
      )
      .eq("created_by", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    jobs = data.map(normalizeJob);
    await loadPhotosForJobs(jobs.map((job) => job.id));
    jobs = jobs.map((job) => ({
      ...job,
      photos: jobPhotosByJobId.get(job.id) || [],
    }));
    activeJobId = activeJobId && getJob(activeJobId) ? activeJobId : jobs[0]?.id || null;
    render();
  } catch (error) {
    jobs = [];
    activeJobId = null;
    render();
    jobList.innerHTML = `<div class="empty-list">Could not load Supabase jobs: ${escapeHtml(error.message)}</div>`;
  }
}

async function createJob(payload) {
  const { data, error } = await supabaseClient.from("jobs").insert(payload).select().single();

  if (error) {
    throw error;
  }

  return normalizeJob(data);
}

async function updateJob(jobId, payload) {
  const { data, error } = await supabaseClient
    .from("jobs")
    .update(payload)
    .eq("id", jobId)
    .eq("created_by", currentUser.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return normalizeJob(data);
}

async function deleteJobRecord(jobId) {
  const { error } = await supabaseClient.from("jobs").delete().eq("id", jobId).eq("created_by", currentUser.id);

  if (error) {
    throw error;
  }
}

function normalizeJob(job) {
  return {
    id: job.id,
    title: job.title || "",
    status: job.status || "Open",
    workOrder: job.work_order || "",
    jobDate: job.job_date || "",
    machine: job.machine || "",
    serial: job.serial || "",
    customer: job.customer || "",
    meter: job.meter || "",
    summary: job.summary || "",
    complaint: job.complaint || "",
    cause: job.cause || "",
    correction: job.correction || "",
    parts: job.parts || "",
    createdAt: job.created_at || "",
    createdBy: job.created_by || "",
    updatedBy: job.updated_by || "",
    photos: jobPhotosByJobId.get(job.id) || [],
  };
}

async function loadPhotosForJobs(jobIds) {
  jobPhotosByJobId = new Map();

  if (!jobIds.length) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("job_photos")
    .select("id,job_id,uploaded_by,file_path,file_name,created_at")
    .in("job_id", jobIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const photos = await Promise.all(
    data.map(async (photo) => {
      const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
        .from("job-photos")
        .createSignedUrl(photo.file_path, 60 * 60);

      if (signedUrlError) {
        throw signedUrlError;
      }

      return {
        id: photo.id,
        jobId: photo.job_id,
        uploadedBy: photo.uploaded_by,
        filePath: photo.file_path,
        fileName: photo.file_name,
        createdAt: photo.created_at,
        url: signedUrlData.signedUrl,
      };
    }),
  );

  photos.forEach((photo) => {
    const existingPhotos = jobPhotosByJobId.get(photo.jobId) || [];
    jobPhotosByJobId.set(photo.jobId, [...existingPhotos, photo]);
  });
}

async function uploadStagedPhotos(jobId) {
  if (!stagedPhotos.length) {
    return;
  }

  for (const photo of stagedPhotos) {
    const filePath = createPhotoPath(jobId, photo.name);
    const { error: uploadError } = await supabaseClient.storage
      .from("job-photos")
      .upload(filePath, photo.blob, {
        contentType: photo.blob.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { error: insertError } = await supabaseClient.from("job_photos").insert({
      job_id: jobId,
      uploaded_by: currentUser.id,
      file_path: filePath,
      file_name: photo.name,
    });

    if (insertError) {
      await supabaseClient.storage.from("job-photos").remove([filePath]);
      throw insertError;
    }
  }
}

function render() {
  renderStats();
  renderJobList();
  renderDetail();
}

function renderStats() {
  document.querySelector("#totalJobs").textContent = jobs.length;
  document.querySelector("#openJobs").textContent = jobs.filter((job) => job.status !== "Complete").length;
  document.querySelector("#photoCount").textContent = jobs.reduce((count, job) => count + job.photos.length, 0);
}

function renderJobList() {
  const term = searchInput.value.trim().toLowerCase();
  const filteredJobs = jobs.filter((job) => {
    const matchesFilter = activeFilter === "All" || job.status === activeFilter;
    const haystack = [
      job.title,
      job.status,
      job.workOrder,
      job.jobDate,
      job.machine,
      job.serial,
      job.customer,
      job.summary,
    ]
      .join(" ")
      .toLowerCase();

    return matchesFilter && haystack.includes(term);
  });

  jobList.innerHTML = "";

  if (!filteredJobs.length) {
    jobList.innerHTML = '<div class="empty-list">No jobs match that search yet.</div>';
    return;
  }

  const template = document.querySelector("#jobCardTemplate");

  filteredJobs.forEach((job) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const status = card.querySelector(".status-pill");

    card.dataset.id = job.id;
    card.classList.toggle("active", job.id === activeJobId);
    status.textContent = job.status;
    status.className = `status-pill ${job.status.split(" ")[0]}`;
    card.querySelector("strong").textContent = job.title;
    card.querySelector("small").textContent = [job.workOrder, job.machine, job.serial].filter(Boolean).join(" | ");
    card.querySelector("p").textContent = job.summary;
    card.addEventListener("click", () => {
      activeJobId = job.id;
      renderJobList();
      renderDetail();
      document.querySelector("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    jobList.append(card);
  });
}

function renderDetail() {
  const job = getJob(activeJobId);

  if (!job) {
    detail.classList.add("hidden");
    emptyDetail.classList.remove("hidden");
    return;
  }

  emptyDetail.classList.add("hidden");
  detail.classList.remove("hidden");
  detail.innerHTML = `
    <div class="job-title-line">
      <div>
        <p class="eyebrow">Job details</p>
        <h2>${escapeHtml(job.title)}</h2>
      </div>
      <span class="status-pill ${job.status.split(" ")[0]}">${escapeHtml(job.status)}</span>
    </div>

    <div class="detail-meta">
      ${metaItem("Work order", job.workOrder)}
      ${metaItem("Date", formatDate(job.jobDate))}
      ${metaItem("Machine", job.machine)}
      ${metaItem("Serial", job.serial)}
      ${metaItem("Customer / location", job.customer)}
      ${metaItem("Hours / miles", job.meter)}
    </div>

    <div class="detail-grid">
      ${noteBlock("Brief summary", job.summary, true)}
      ${noteBlock("Complaint", job.complaint)}
      ${noteBlock("Cause", job.cause)}
      ${noteBlock("Correction", job.correction)}
      ${noteBlock("Parts / fluids / tooling", job.parts)}
    </div>

    <div class="photo-section">
      <h3>Photos (${job.photos.length})</h3>
      <div class="photo-gallery">
        ${
          job.photos.length
            ? job.photos
                .map(
                  (photo) => `
                    <figure class="photo-tile">
                      <img src="${photo.url}" alt="${escapeHtml(photo.fileName)}" />
                      <figcaption>${escapeHtml(photo.fileName)}</figcaption>
                      <button class="photo-delete" type="button" data-photo-id="${photo.id}">Delete</button>
                    </figure>
                  `,
                )
                .join("")
            : "<p>No photos saved on this job yet.</p>"
        }
      </div>
    </div>

    <div class="detail-actions">
      <button class="button primary" type="button" data-action="edit">Edit job</button>
      <button class="button secondary" type="button" data-action="copy">Show copy-ready report</button>
      <button class="button danger" type="button" data-action="delete">Delete job</button>
    </div>

    <textarea class="copy-output hidden" readonly>${escapeHtml(buildReport(job))}</textarea>
  `;

  detail.querySelector("[data-action='edit']").addEventListener("click", () => editJob(job.id));
  detail.querySelector("[data-action='copy']").addEventListener("click", () => {
    const output = detail.querySelector(".copy-output");
    output.classList.toggle("hidden");
    output.select();
  });
  detail.querySelector("[data-action='delete']").addEventListener("click", () => deleteJob(job.id));
  detail.querySelectorAll("[data-photo-id]").forEach((button) => {
    button.addEventListener("click", () => deletePhoto(button.dataset.photoId));
  });
}

function editJob(jobId) {
  const job = getJob(jobId);
  editingJobId = jobId;
  submitButton.textContent = "Update job";
  stagedPhotos = [];
  renderPhotoPreview(stagedPhotos);

  Object.entries(job).forEach(([key, value]) => {
    const input = form.elements[key];
    if (input && typeof value === "string") {
      input.value = value;
    }
  });

  document.querySelector("#new-job").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteJob(jobId) {
  const job = getJob(jobId);
  const confirmed = confirm(`Delete "${job.title}"? This removes it from Supabase.`);

  if (!confirmed) {
    return;
  }

  try {
    const photoPaths = job.photos.map((photo) => photo.filePath);
    await deleteJobRecord(jobId);

    if (photoPaths.length) {
      await supabaseClient.storage.from("job-photos").remove(photoPaths);
    }

    activeJobId = jobs.find((savedJob) => savedJob.id !== jobId)?.id || null;
    resetForm();
    await loadJobs();
  } catch (error) {
    alert(`Supabase delete failed: ${error.message}`);
  }
}

async function deletePhoto(photoId) {
  const job = getJob(activeJobId);
  const photo = job?.photos.find((savedPhoto) => savedPhoto.id === photoId);

  if (!photo) {
    return;
  }

  const confirmed = confirm(`Delete photo "${photo.fileName}"?`);

  if (!confirmed) {
    return;
  }

  try {
    const { error: deleteError } = await supabaseClient
      .from("job_photos")
      .delete()
      .eq("id", photo.id)
      .eq("uploaded_by", currentUser.id);

    if (deleteError) {
      throw deleteError;
    }

    const { error: storageError } = await supabaseClient.storage.from("job-photos").remove([photo.filePath]);

    if (storageError) {
      throw storageError;
    }

    await loadJobs();
  } catch (error) {
    alert(`Photo delete failed: ${error.message}`);
  }
}

function resetForm() {
  form.reset();
  editingJobId = null;
  revokePhotoPreviews();
  stagedPhotos = [];
  submitButton.disabled = false;
  submitButton.textContent = "Save job";
  photoInput.value = "";
  renderPhotoPreview(stagedPhotos);
  setDefaultDate();
}

async function readPhotos(files) {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  return Promise.all(imageFiles.map((file) => resizePhoto(file)));
}

function resizePhoto(file) {
  return new Promise((resolve) => {
    const image = new Image();
    const reader = new FileReader();

    image.addEventListener("load", () => {
      const maxSize = 1400;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          const name = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`;

          resolve({
            name,
            blob,
            previewUrl: URL.createObjectURL(blob),
          });
        },
        "image/jpeg",
        0.78,
      );
    });

    reader.addEventListener("load", () => {
      image.src = reader.result;
    });

    reader.readAsDataURL(file);
  });
}

function createPhotoPath(jobId, fileName) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const id = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${currentUser.id}/${jobId}/${id}-${safeName || "photo.jpg"}`;
}

function revokePhotoPreviews() {
  stagedPhotos.forEach((photo) => {
    if (photo.previewUrl) {
      URL.revokeObjectURL(photo.previewUrl);
    }
  });
}

function renderPhotoPreview(photos) {
  photoPreview.innerHTML = photos
    .map((photo) => `<img src="${photo.previewUrl}" alt="${escapeHtml(photo.name)}" />`)
    .join("");
}

function getJob(jobId) {
  return jobs.find((job) => job.id === jobId);
}

function getValue(formData, key) {
  return String(formData.get(key) || "").trim();
}

function setDefaultDate() {
  if (!form.elements.jobDate.value) {
    form.elements.jobDate.value = new Date().toISOString().slice(0, 10);
  }
}

function metaItem(label, value) {
  if (!value) {
    return "";
  }

  return `<span>${label}: ${escapeHtml(value)}</span>`;
}

function noteBlock(label, value, full = false) {
  return `
    <section class="note-block ${full ? "full" : ""}">
      <strong>${label}</strong>
      <p>${escapeHtml(value || "Not recorded yet.")}</p>
    </section>
  `;
}

function buildReport(job) {
  return [
    `Job: ${job.title}`,
    `Status: ${job.status}`,
    `Work Order: ${job.workOrder || "N/A"}`,
    `Date: ${formatDate(job.jobDate) || "N/A"}`,
    `Machine: ${job.machine || "N/A"}`,
    `Serial: ${job.serial || "N/A"}`,
    `Customer / Location: ${job.customer || "N/A"}`,
    `Hours / Miles: ${job.meter || "N/A"}`,
    "",
    `Summary: ${job.summary || "N/A"}`,
    "",
    `Complaint: ${job.complaint || "N/A"}`,
    "",
    `Cause: ${job.cause || "N/A"}`,
    "",
    `Correction: ${job.correction || "N/A"}`,
    "",
    `Parts / Fluids / Tooling: ${job.parts || "N/A"}`,
    "",
    `Photos attached in IronProof: ${job.photos.length}`,
  ].join("\n");
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  return new Date(`${dateValue}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function setAuthMessage(message) {
  authMessage.textContent = message;
}

function showSupabaseSetupMessage() {
  setAuthMessage("Add SUPABASE_URL and SUPABASE_ANON_KEY in the project environment to use IronProof.");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
