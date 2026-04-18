const authPanel = document.querySelector("#authPanel");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const userMenu = document.querySelector("#userMenu");
const userDisplay = document.querySelector("#userDisplay");
const logoutButton = document.querySelector("#logoutButton");
const themeButtons = document.querySelectorAll("[data-theme]");
const workspace = document.querySelector(".workspace");
const detailPanel = document.querySelector("#detail");
const form = document.querySelector("#jobForm");
const photoDrop = document.querySelector(".photo-drop");
const photoInput = document.querySelector("#photos");
const photoPreview = document.querySelector("#photoPreview");
const photoStatus = document.querySelector("#photoStatus");
const diagnosticInput = document.querySelector("#diagnosticFile");
const diagnosticStatus = document.querySelector("#diagnosticStatus");
const photoModal = document.querySelector("#photoModal");
const photoModalImage = document.querySelector("#photoModalImage");
const jobList = document.querySelector("#jobList");
const searchInput = document.querySelector("#searchInput");
const boardJoinCode = document.querySelector("#boardJoinCode");
const boardJoinCrewButton = document.querySelector("#boardJoinCrewButton");
const crewBoardMessage = document.querySelector("#crewBoardMessage");
const filterButtons = document.querySelectorAll(".filter-button");
const detail = document.querySelector("#jobDetail");
const emptyDetail = document.querySelector("#emptyDetail");
const submitButton = document.querySelector("#submitButton");
const clearFormButton = document.querySelector("#clearFormButton");
const jobTypeInputs = document.querySelectorAll("input[name='jobType']");
const jobTypeFields = document.querySelectorAll("[data-job-type-fields]");
const visibilityInputs = document.querySelectorAll("input[name='visibilityType']");
const visibilityMessage = document.querySelector("#visibilityMessage");

const supabaseConfig = window.IRONPROOF_SUPABASE || {};
const supabaseClient =
  window.supabase && supabaseConfig.url && supabaseConfig.anonKey
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
    : null;

let currentUser = null;
let currentProfile = null;
let jobs = [];
let jobPhotosByJobId = new Map();
let diagnosticFilesByJobId = new Map();
let jobCrewsByJobId = new Map();
let jobCrewMembersByJobId = new Map();
let activeFilter = "All";
let activeJobId = null;
let editingJobId = null;
let stagedPhotos = [];
let stagedDiagnosticFile = null;

applyTheme("light");
setDefaultDate();
updateJobTypeFields("Heavy");
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

themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.theme));
});

photoModal.addEventListener("click", (event) => {
  if (event.target === photoModal) {
    closePhotoModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !photoModal.classList.contains("hidden")) {
    closePhotoModal();
  }
});

photoDrop.addEventListener("click", () => {
  console.log("[IronProof photos] button click");
  showPhotoStatus("Opening photo picker...");
});

photoInput.addEventListener("change", async (event) => {
  const files = [...event.target.files];
  console.log("[IronProof photos] file selected", {
    count: files.length,
    files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
  });

  try {
    revokePhotoPreviews();
    stagedPhotos = await readPhotos(files);
    console.log("[IronProof photos] files staged for upload", {
      count: stagedPhotos.length,
      files: stagedPhotos.map((photo) => ({ name: photo.name, size: photo.blob?.size })),
    });
    renderPhotoPreview(stagedPhotos);
    showPhotoStatus(
      stagedPhotos.length
        ? `${stagedPhotos.length} photo${stagedPhotos.length === 1 ? "" : "s"} ready. Save the job to upload.`
        : "No supported image files were selected.",
    );
  } catch (error) {
    console.error("[IronProof photos] file processing failure", error);
    stagedPhotos = [];
    renderPhotoPreview(stagedPhotos);
    showPhotoStatus(`Photo selection failed: ${error.message}`);
    alert(`Photo selection failed: ${error.message}`);
  }
});

diagnosticInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  stagedDiagnosticFile = file || null;
  showDiagnosticStatus(
    stagedDiagnosticFile
      ? `${stagedDiagnosticFile.name} ready. Save the Heavy job to upload.`
      : "",
  );
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
  const jobType = getValue(formData, "jobType") || "Heavy";
  const visibilityType = getValue(formData, "visibilityType") || "solo";

  const existingJob = editingJobId ? getJob(editingJobId) : null;

  const payload = {
    job_type: jobType,
    visibility_type: visibilityType,
    crew_id: visibilityType === "crew" ? existingJob?.crewId || null : null,
    title: getValue(formData, "title"),
    status: getValue(formData, "status") || "Open",
    work_order: getValue(formData, "workOrder"),
    job_date: getValue(formData, "jobDate") || null,
    customer_name: getValue(formData, "customerName"),
    customer_phone: getValue(formData, "customerPhone"),
    customer_email: getValue(formData, "customerEmail"),
    machine: getValue(formData, "machine"),
    serial: getValue(formData, "serial"),
    customer: getValue(formData, "customer"),
    meter: getValue(formData, "meter"),
    year: getValue(formData, "year"),
    make: getValue(formData, "make"),
    model: getValue(formData, "model"),
    vin: getValue(formData, "vin"),
    mileage: getValue(formData, "mileage"),
    summary: getValue(formData, "summary"),
    complaint: getValue(formData, "complaint"),
    cause: getValue(formData, "cause"),
    correction: getValue(formData, "correction"),
    customer_concern: getValue(formData, "customerConcern"),
    diagnosis: getValue(formData, "diagnosis"),
    repair_performed: getValue(formData, "repairPerformed"),
    parts: getValue(formData, "parts"),
    updated_by: currentUser.id,
  };

  submitButton.disabled = true;
  submitButton.textContent = editingJobId ? "Updating..." : "Saving...";
  const photosToUpload = [...stagedPhotos];
  const diagnosticFileToUpload = jobType === "Heavy" ? stagedDiagnosticFile : null;
  const diagnosticFileType = getValue(formData, "diagnosticFileType");

  try {
    const savedJob = editingJobId
      ? await updateJob(editingJobId, payload)
      : await createJob({ ...payload, created_by: currentUser.id });
    const jobIdForPhotos = editingJobId || savedJob?.id;
    console.log("[IronProof photos] saved job before photo upload", {
      returnedJobId: savedJob?.id,
      jobIdForPhotos,
      stagedPhotoCount: photosToUpload.length,
    });
    await uploadStagedPhotos(jobIdForPhotos, photosToUpload);
    await uploadDiagnosticFile(jobIdForPhotos, diagnosticFileToUpload, diagnosticFileType);
    activeJobId = jobIdForPhotos;
    await loadJobs();
    resetForm();
  } catch (error) {
    console.error("[IronProof photos] job save or photo upload failure", error);
    showPhotoStatus(`Save/upload failed: ${error.message}`);
    alert(`Supabase save failed: ${error.message}`);
    submitButton.textContent = editingJobId ? "Update job" : "Save job";
  } finally {
    submitButton.disabled = false;
  }
});

clearFormButton.addEventListener("click", resetForm);

searchInput.addEventListener("input", renderJobList);

boardJoinCrewButton.addEventListener("click", () => joinCrewForJob(boardJoinCode.value));

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderJobList();
  });
});

jobTypeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateJobTypeFields(input.value);
  });
});

visibilityInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateVisibilityMessage(input.value);
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
  applyTheme(currentProfile?.theme || "light");
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
  applyTheme("light");
  jobs = [];
  jobCrewsByJobId = new Map();
  jobCrewMembersByJobId = new Map();
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
      theme: "light",
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
    const crewIds = await loadCrewIdsForCurrentUser();
    const jobSelect =
      "id,job_type,visibility_type,crew_id,title,status,work_order,job_date,customer,customer_name,customer_phone,customer_email,machine,serial,meter,year,make,model,vin,mileage,summary,complaint,cause,correction,customer_concern,diagnosis,repair_performed,parts,created_at,created_by,updated_by";
    const query = supabaseClient.from("jobs").select(jobSelect).order("created_at", { ascending: false });
    const { data, error } = crewIds.length
      ? await query.or(`created_by.eq.${currentUser.id},crew_id.in.(${crewIds.join(",")})`)
      : await query.eq("created_by", currentUser.id);

    if (error) {
      throw error;
    }

    jobs = data.map(normalizeJob);
    await loadJobCrewsForJobs(jobs.map((job) => job.id));
    await loadPhotosForJobs(jobs.map((job) => job.id));
    await loadDiagnosticFilesForJobs(jobs.map((job) => job.id));
    jobs = jobs.map((job) => ({
      ...job,
      crew: jobCrewsByJobId.get(job.id) || null,
      crewMembers: jobCrewMembersByJobId.get(job.id) || [],
      photos: jobPhotosByJobId.get(job.id) || [],
      diagnosticFiles: diagnosticFilesByJobId.get(job.id) || [],
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

async function loadCrewIdsForCurrentUser() {
  const { data: memberships, error: membershipError } = await supabaseClient
    .from("job_crew_members")
    .select("job_crew_id")
    .eq("user_id", currentUser.id);

  if (membershipError) {
    throw membershipError;
  }

  const crewIds = [...new Set(memberships.map((membership) => membership.job_crew_id).filter(Boolean))];

  return crewIds;
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
    .select()
    .single();

  if (error) {
    throw error;
  }

  return normalizeJob(data);
}

async function deleteJobRecord(jobId) {
  const { error } = await supabaseClient.from("jobs").delete().eq("id", jobId);

  if (error) {
    throw error;
  }
}

async function loadJobCrewsForJobs(jobIds) {
  jobCrewsByJobId = new Map();
  jobCrewMembersByJobId = new Map();

  if (!jobIds.length) {
    return;
  }

  const { data: crews, error: crewError } = await supabaseClient
    .from("job_crews")
    .select("id,job_id,name,join_code,created_by,created_at")
    .in("job_id", jobIds);

  if (crewError) {
    throw crewError;
  }

  const jobIdByCrewId = new Map();

  crews.forEach((crew) => {
    jobIdByCrewId.set(crew.id, crew.job_id);
    jobCrewsByJobId.set(crew.job_id, {
      id: crew.id,
      jobId: crew.job_id,
      name: crew.name,
      joinCode: crew.join_code,
      createdBy: crew.created_by,
      createdAt: crew.created_at,
    });
  });

  if (!crews.length) {
    return;
  }

  const { data: members, error: memberError } = await supabaseClient
    .from("job_crew_members")
    .select("id,job_crew_id,user_id,role,created_at,profiles(display_name,email)")
    .in(
      "job_crew_id",
      crews.map((crew) => crew.id),
    )
    .order("created_at", { ascending: true });

  if (memberError) {
    throw memberError;
  }

  members.forEach((member) => {
    const jobId = jobIdByCrewId.get(member.job_crew_id);

    if (!jobId) {
      return;
    }

    const existingMembers = jobCrewMembersByJobId.get(jobId) || [];
    jobCrewMembersByJobId.set(jobId, [
      ...existingMembers,
      {
        id: member.id,
        jobId,
        jobCrewId: member.job_crew_id,
        userId: member.user_id,
        role: member.role,
        createdAt: member.created_at,
        displayName: member.profiles?.display_name || member.profiles?.email || member.user_id,
        email: member.profiles?.email || "",
      },
    ]);
  });
}

function normalizeJob(job) {
  return {
    id: job.id,
    jobType: job.job_type || "Heavy",
    visibilityType: job.visibility_type || "solo",
    crewId: job.crew_id || "",
    title: job.title || "",
    status: job.status || "Open",
    workOrder: job.work_order || "",
    jobDate: job.job_date || "",
    customerName: job.customer_name || job.customer || "",
    customerPhone: job.customer_phone || "",
    customerEmail: job.customer_email || "",
    machine: job.machine || "",
    serial: job.serial || "",
    customer: job.customer || "",
    meter: job.meter || "",
    year: job.year || "",
    make: job.make || "",
    model: job.model || "",
    vin: job.vin || "",
    mileage: job.mileage || "",
    summary: job.summary || "",
    complaint: job.complaint || "",
    cause: job.cause || "",
    correction: job.correction || "",
    customerConcern: job.customer_concern || "",
    diagnosis: job.diagnosis || "",
    repairPerformed: job.repair_performed || "",
    parts: job.parts || "",
    createdAt: job.created_at || "",
    createdBy: job.created_by || "",
    updatedBy: job.updated_by || "",
    crew: jobCrewsByJobId.get(job.id) || null,
    crewMembers: jobCrewMembersByJobId.get(job.id) || [],
    photos: jobPhotosByJobId.get(job.id) || [],
    diagnosticFiles: diagnosticFilesByJobId.get(job.id) || [],
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

async function loadDiagnosticFilesForJobs(jobIds) {
  diagnosticFilesByJobId = new Map();

  if (!jobIds.length) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("diagnostic_files")
    .select("id,job_id,uploaded_by,file_name,file_path,file_type,created_at")
    .in("job_id", jobIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const files = await Promise.all(
    data.map(async (file) => {
      const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
        .from("diagnostic-files")
        .createSignedUrl(file.file_path, 60 * 60);

      if (signedUrlError) {
        throw signedUrlError;
      }

      return {
        id: file.id,
        jobId: file.job_id,
        uploadedBy: file.uploaded_by,
        fileName: file.file_name,
        filePath: file.file_path,
        fileType: file.file_type,
        createdAt: file.created_at,
        url: signedUrlData.signedUrl,
      };
    }),
  );

  files.forEach((file) => {
    const existingFiles = diagnosticFilesByJobId.get(file.jobId) || [];
    diagnosticFilesByJobId.set(file.jobId, [...existingFiles, file]);
  });
}

async function uploadStagedPhotos(jobId, photosToUpload = stagedPhotos) {
  console.log("[IronProof photos] upload function called", {
    jobId,
    stagedPhotoCount: photosToUpload.length,
  });

  if (!jobId) {
    const error = new Error("Cannot upload photos because the saved job id is missing.");
    console.error("[IronProof photos] upload failure", error);
    showPhotoStatus(error.message);
    throw error;
  }

  if (!photosToUpload.length) {
    console.log("[IronProof photos] upload skipped: no staged photos");
    return;
  }

  showPhotoStatus(`Uploading ${photosToUpload.length} photo${photosToUpload.length === 1 ? "" : "s"}...`);

  for (const photo of photosToUpload) {
    const filePath = createPhotoPath(jobId, photo.name);
    console.log("[IronProof photos] upload started", {
      jobId,
      fileName: photo.name,
      filePath,
      size: photo.blob?.size,
    });

    try {
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

      console.log("[IronProof photos] upload success", {
        jobId,
        fileName: photo.name,
        filePath,
      });
    } catch (error) {
      console.error("[IronProof photos] upload failure", {
        jobId,
        fileName: photo.name,
        filePath,
        error,
      });
      showPhotoStatus(`Photo upload failed for ${photo.name}: ${error.message}`);
      alert(`Photo upload failed for ${photo.name}: ${error.message}`);
      throw error;
    }
  }

  showPhotoStatus(`Uploaded ${photosToUpload.length} photo${photosToUpload.length === 1 ? "" : "s"} successfully.`);
}

async function uploadDiagnosticFile(jobId, file, fileType) {
  if (!file) {
    return;
  }

  if (!jobId) {
    const error = new Error("Cannot upload diagnostic file because the saved job id is missing.");
    showDiagnosticStatus(error.message);
    throw error;
  }

  showDiagnosticStatus(`Uploading ${file.name}...`);

  const filePath = createDiagnosticFilePath(jobId, file.name);
  const { error: uploadError } = await supabaseClient.storage
    .from("diagnostic-files")
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    showDiagnosticStatus(`Diagnostic upload failed: ${uploadError.message}`);
    throw uploadError;
  }

  const { error: insertError } = await supabaseClient.from("diagnostic_files").insert({
    job_id: jobId,
    uploaded_by: currentUser.id,
    file_name: file.name,
    file_path: filePath,
    file_type: fileType || "Other",
  });

  if (insertError) {
    await supabaseClient.storage.from("diagnostic-files").remove([filePath]);
    showDiagnosticStatus(`Diagnostic metadata save failed: ${insertError.message}`);
    throw insertError;
  }

  showDiagnosticStatus(`Uploaded ${file.name}.`);
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
      getVisibilityLabel(job),
      job.workOrder,
      job.jobDate,
      job.customerName,
      job.customerPhone,
      job.customerEmail,
      job.machine,
      job.serial,
      job.customer,
      job.year,
      job.make,
      job.model,
      job.vin,
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

  renderJobListSection("My Solo Jobs", filteredJobs.filter((job) => job.visibilityType !== "crew"));
  renderJobListSection("Crew Jobs", filteredJobs.filter((job) => job.visibilityType === "crew"));
}

function renderJobListSection(title, sectionJobs) {
  const section = document.createElement("section");
  section.className = "job-list-section";
  section.innerHTML = `<h3>${escapeHtml(title)}</h3>`;

  if (!sectionJobs.length) {
    section.insertAdjacentHTML("beforeend", '<div class="empty-list">No jobs here yet.</div>');
    jobList.append(section);
    return;
  }

  const template = document.querySelector("#jobCardTemplate");

  sectionJobs.forEach((job) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const status = card.querySelector(".status-pill");

    card.dataset.id = job.id;
    card.classList.toggle("active", job.id === activeJobId);
    status.textContent = job.status;
    status.className = `status-pill ${job.status.split(" ")[0]}`;
    card.querySelector("strong").textContent = job.title;
    card.querySelector("small").textContent = [getVisibilityLabel(job), job.workOrder, getPrimaryUnitLabel(job), getPrimaryIdentifier(job)]
      .filter(Boolean)
      .join(" | ");
    card.querySelector("p").textContent = job.summary;
    card.addEventListener("click", () => {
      activeJobId = job.id;
      renderJobList();
      renderDetail();
      document.querySelector("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    section.append(card);
  });

  jobList.append(section);
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
  const canManageJob = canManageCrewJob(job);
  detail.innerHTML = `
    <div class="job-title-line">
      <div>
        <p class="eyebrow">Job details</p>
        <h2>${escapeHtml(job.title)}</h2>
      </div>
      <span class="status-pill ${job.status.split(" ")[0]}">${escapeHtml(job.status)}</span>
    </div>

    <div class="detail-meta">
      ${metaItem("Job type", job.jobType)}
      ${metaItem("Visibility", getVisibilityLabel(job))}
      ${job.visibilityType === "crew" ? metaItem("Your crew role", getCurrentUserCrewRoleLabel(job)) : ""}
      ${metaItem("Work order", job.workOrder)}
      ${metaItem("Date", formatDate(job.jobDate))}
      ${metaItem("Customer", job.customerName)}
      ${metaItem("Phone", job.customerPhone)}
      ${metaItem("Email", job.customerEmail)}
      ${job.jobType === "Automotive" ? renderAutomotiveMeta(job) : renderHeavyMeta(job)}
    </div>

    <div class="detail-grid">
      ${noteBlock("Brief summary", job.summary, true)}
      ${job.jobType === "Automotive" ? renderAutomotiveNotes(job) : renderHeavyNotes(job)}
      ${noteBlock("Parts / fluids / tooling", job.parts)}
    </div>

    ${job.visibilityType === "crew" ? renderCrewPanel(job) : ""}

    ${
      job.jobType === "Heavy"
        ? `
          <div class="photo-section">
            <h3>Diagnostics (${job.diagnosticFiles.length})</h3>
            ${renderDiagnosticFiles(job)}
          </div>
        `
        : ""
    }

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
                      ${
                        canManageJob || photo.uploadedBy === currentUser?.id
                          ? `<button class="photo-delete" type="button" data-photo-id="${photo.id}">Delete</button>`
                          : ""
                      }
                    </figure>
                  `,
                )
                .join("")
            : "<p>No photos saved on this job yet.</p>"
        }
      </div>
    </div>

    <div class="detail-actions">
      ${canManageJob ? `<button class="button primary" type="button" data-action="edit">Edit job</button>` : ""}
      <button class="button secondary" type="button" data-action="copy">Show copy-ready report</button>
      ${canManageJob ? `<button class="button danger" type="button" data-action="delete">Delete job</button>` : ""}
    </div>

    <textarea class="copy-output hidden" readonly>${escapeHtml(buildReport(job))}</textarea>
  `;

  detail.querySelector("[data-action='edit']")?.addEventListener("click", () => editJob(job.id));
  detail.querySelector("[data-action='copy']").addEventListener("click", () => {
    const output = detail.querySelector(".copy-output");
    output.classList.toggle("hidden");
    output.select();
  });
  detail.querySelector("[data-action='delete']")?.addEventListener("click", () => deleteJob(job.id));
  detail.querySelector("[data-action='create-crew']")?.addEventListener("click", () => createCrewForJob(job.id));
  detail.querySelector("[data-action='join-crew']")?.addEventListener("click", () => {
    const input = detail.querySelector("[data-join-code]");
    joinCrewForJob(input?.value);
  });
  detail.querySelectorAll(".photo-tile img").forEach((image) => {
    image.addEventListener("click", () => openPhotoModal(image.src, image.alt));
  });
  detail.querySelectorAll("[data-photo-id]").forEach((button) => {
    button.addEventListener("click", () => deletePhoto(button.dataset.photoId));
  });
  detail.querySelectorAll("[data-diagnostic-id]").forEach((button) => {
    button.addEventListener("click", () => deleteDiagnosticFile(button.dataset.diagnosticId));
  });
  detail.querySelectorAll("[data-member-role]").forEach((select) => {
    select.addEventListener("change", () => updateCrewMemberRole(select.dataset.memberRole, select.value));
  });
}

function openPhotoModal(src, alt) {
  photoModalImage.src = src;
  photoModalImage.alt = alt;
  photoModal.classList.remove("hidden");
  photoModal.setAttribute("aria-hidden", "false");
}

function closePhotoModal() {
  photoModal.classList.add("hidden");
  photoModal.setAttribute("aria-hidden", "true");
  photoModalImage.src = "";
  photoModalImage.alt = "";
}

function updateJobTypeFields(jobType) {
  jobTypeFields.forEach((fieldGroup) => {
    fieldGroup.classList.toggle("hidden", fieldGroup.dataset.jobTypeFields !== jobType);
  });
}

function setJobType(jobType) {
  const nextJobType = jobType || "Heavy";
  jobTypeInputs.forEach((input) => {
    input.checked = input.value === nextJobType;
  });
  updateJobTypeFields(nextJobType);
}

function setVisibilityType(visibilityType) {
  const nextVisibilityType = visibilityType || "solo";
  visibilityInputs.forEach((input) => {
    input.checked = input.value === nextVisibilityType;
  });
  updateVisibilityMessage(nextVisibilityType);
}

function updateVisibilityMessage(visibilityType) {
  if (visibilityType === "crew") {
    showVisibilityMessage("Crew jobs can have their own job-specific crew after the job is saved.");
    return;
  }

  showVisibilityMessage("");
}

function editJob(jobId) {
  const job = getJob(jobId);
  editingJobId = jobId;
  submitButton.textContent = "Update job";
  stagedPhotos = [];
  renderPhotoPreview(stagedPhotos);
  setJobType(job.jobType);
  setVisibilityType(job.visibilityType);

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
    const diagnosticPaths = job.diagnosticFiles.map((file) => file.filePath);
    await deleteJobRecord(jobId);

    if (photoPaths.length) {
      await supabaseClient.storage.from("job-photos").remove(photoPaths);
    }

    if (diagnosticPaths.length) {
      await supabaseClient.storage.from("diagnostic-files").remove(diagnosticPaths);
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

  showPhotoStatus(`Deleting ${photo.fileName}...`);

  try {
    const { error: storageError } = await supabaseClient.storage.from("job-photos").remove([photo.filePath]);

    if (storageError) {
      throw new Error(`Storage delete failed: ${storageError.message}`);
    }

    const { error: databaseError } = await supabaseClient
      .from("job_photos")
      .delete()
      .eq("id", photo.id)
      .eq("file_path", photo.filePath);

    if (databaseError) {
      throw new Error(`Database delete failed: ${databaseError.message}`);
    }

    await loadJobs();
    showPhotoStatus(`Deleted ${photo.fileName}.`);
  } catch (error) {
    console.error("[IronProof photos] delete failure", {
      photoId: photo.id,
      filePath: photo.filePath,
      error,
    });
    showPhotoStatus(`Photo delete failed: ${error.message}`);
    alert(`Photo delete failed: ${error.message}`);
  }
}

async function deleteDiagnosticFile(diagnosticId) {
  const job = getJob(activeJobId);
  const file = job?.diagnosticFiles.find((savedFile) => savedFile.id === diagnosticId);

  if (!file) {
    return;
  }

  const confirmed = confirm(`Delete diagnostic file "${file.fileName}"?`);

  if (!confirmed) {
    return;
  }

  showDiagnosticStatus(`Deleting ${file.fileName}...`);

  try {
    const { error: storageError } = await supabaseClient.storage.from("diagnostic-files").remove([file.filePath]);

    if (storageError) {
      throw new Error(`Storage delete failed: ${storageError.message}`);
    }

    const { error: databaseError } = await supabaseClient
      .from("diagnostic_files")
      .delete()
      .eq("id", file.id)
      .eq("file_path", file.filePath);

    if (databaseError) {
      throw new Error(`Database delete failed: ${databaseError.message}`);
    }

    await loadJobs();
    showDiagnosticStatus(`Deleted ${file.fileName}.`);
  } catch (error) {
    console.error("[IronProof diagnostics] delete failure", {
      diagnosticId: file.id,
      filePath: file.filePath,
      error,
    });
    showDiagnosticStatus(`Diagnostic delete failed: ${error.message}`);
    alert(`Diagnostic delete failed: ${error.message}`);
  }
}

async function createCrewForJob(jobId) {
  const job = getJob(jobId);

  if (!job || job.visibilityType !== "crew") {
    return;
  }

  showVisibilityMessage("Creating job crew...");

  try {
    const joinCode = createJobCrewJoinCode();
    if (!joinCode) {
      throw new Error("IronProof could not generate a crew join code.");
    }

    const crewPayload = {
      job_id: jobId,
      name: createJobCrewName(job),
      join_code: joinCode,
      created_by: currentUser.id,
    };
    const { data: createdCrew, error } = await supabaseClient
      .from("job_crews")
      .insert(crewPayload)
      .select("id,job_id,name,join_code,created_by,created_at")
      .single();

    if (error) {
      throw error;
    }

    const savedCrew = await ensureCreatedCrewHasJoinCode(createdCrew, jobId, joinCode);
    applyCreatedCrewToJob(jobId, savedCrew);
    activeJobId = jobId;
    renderDetail();
    await loadJobs();
    showVisibilityMessage("Crew created for this job.");
  } catch (error) {
    showVisibilityMessage(`Crew creation failed: ${error.message}`);
    alert(`Crew creation failed: ${error.message}`);
  }
}

async function ensureCreatedCrewHasJoinCode(createdCrew, jobId, joinCode) {
  if (createdCrew?.join_code) {
    return createdCrew;
  }

  const { data: reloadedCrew, error: reloadError } = await supabaseClient
    .from("job_crews")
    .select("id,job_id,name,join_code,created_by,created_at")
    .eq("job_id", jobId)
    .maybeSingle();

  if (reloadError) {
    throw reloadError;
  }

  if (reloadedCrew?.join_code) {
    return reloadedCrew;
  }

  const crewId = createdCrew?.id || reloadedCrew?.id;

  if (!crewId) {
    throw new Error("Crew was created, but IronProof could not reload it to confirm the join code.");
  }

  const { data: repairedCrew, error: repairError } = await supabaseClient
    .from("job_crews")
    .update({ join_code: joinCode })
    .eq("id", crewId)
    .select("id,job_id,name,join_code,created_by,created_at")
    .single();

  if (repairError) {
    throw repairError;
  }

  if (!repairedCrew?.join_code) {
    throw new Error("Crew was created, but Supabase returned an empty join code after repair.");
  }

  return repairedCrew;
}

function applyCreatedCrewToJob(jobId, crew) {
  if (!crew?.join_code) {
    return;
  }

  const normalizedCrew = {
    id: crew.id,
    jobId: crew.job_id,
    name: crew.name,
    joinCode: crew.join_code,
    createdBy: crew.created_by,
    createdAt: crew.created_at,
  };
  const existingMembers = jobCrewMembersByJobId.get(jobId) || [];
  const leadMember = {
    id: `${crew.id}-${currentUser.id}`,
    jobId,
    jobCrewId: crew.id,
    userId: currentUser.id,
    role: "crew_lead",
    createdAt: crew.created_at,
    displayName: currentProfile?.display_name || currentUser.email,
    email: currentProfile?.email || currentUser.email,
  };
  const nextMembers = existingMembers.some((member) => member.userId === currentUser.id)
    ? existingMembers
    : [...existingMembers, leadMember];

  jobCrewsByJobId.set(jobId, normalizedCrew);
  jobCrewMembersByJobId.set(jobId, nextMembers);
  jobs = jobs.map((job) =>
    job.id === jobId ? { ...job, crew: normalizedCrew, crewId: crew.id, crewMembers: nextMembers } : job,
  );
}

async function joinCrewForJob(joinCode) {
  const code = String(joinCode || "").trim();

  if (!code) {
    showVisibilityMessage("Enter a crew join code first.");
    return;
  }

  showVisibilityMessage("Joining job crew...");

  try {
    const { error } = await supabaseClient.rpc("join_job_crew", {
      join_code_input: code,
    });

    if (error) {
      throw error;
    }

    await loadJobs();
    boardJoinCode.value = "";
    showVisibilityMessage("Joined the job crew.");
    showCrewBoardMessage("Joined the job crew.");
  } catch (error) {
    showVisibilityMessage(`Join failed: ${error.message}`);
    showCrewBoardMessage(`Join failed: ${error.message}`);
    alert(`Join failed: ${error.message}`);
  }
}

async function updateCrewMemberRole(memberId, role) {
  const nextRole = String(role || "").trim();

  if (!["crew_worker", "supervisor"].includes(nextRole)) {
    showVisibilityMessage("Crew leads can assign Crew Worker or Supervisor roles.");
    return;
  }

  showVisibilityMessage("Updating crew member role...");

  try {
    const { error } = await supabaseClient
      .from("job_crew_members")
      .update({ role: nextRole })
      .eq("id", memberId);

    if (error) {
      throw error;
    }

    await loadJobs();
    showVisibilityMessage("Crew member role updated.");
  } catch (error) {
    showVisibilityMessage(`Role update failed: ${error.message}`);
    alert(`Role update failed: ${error.message}`);
    await loadJobs();
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
  diagnosticInput.value = "";
  stagedDiagnosticFile = null;
  renderPhotoPreview(stagedPhotos);
  showPhotoStatus("");
  showDiagnosticStatus("");
  showVisibilityMessage("");
  setDefaultDate();
  setJobType("Heavy");
  setVisibilityType("solo");
}

async function readPhotos(files) {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  console.log("[IronProof photos] passing selected files into processing", {
    selectedCount: files.length,
    imageCount: imageFiles.length,
  });
  return Promise.all(imageFiles.map((file) => resizePhoto(file)));
}

function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();

    image.addEventListener("error", () => {
      reject(new Error(`Could not read image ${file.name}. Try a JPEG or PNG file.`));
    });

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
          if (!blob) {
            reject(new Error(`Could not compress image ${file.name}.`));
            return;
          }

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

    reader.addEventListener("error", () => {
      reject(new Error(`Could not load file ${file.name}.`));
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

function createDiagnosticFilePath(jobId, fileName) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const id = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `diagnostic-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${currentUser.id}/${jobId}/${id}-${safeName || "diagnostic-file"}`;
}

function createJobCrewName(job) {
  const title = String(job?.title || "").trim();

  if (title) {
    return `${title} Crew`;
  }

  return `Crew for Job ${job?.id || "Unknown"}`;
}

function createJobCrewJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomValues = new Uint8Array(4);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    randomValues.forEach((_, index) => {
      randomValues[index] = Math.floor(Math.random() * 256);
    });
  }

  const suffix = [...randomValues].map((value) => alphabet[value % alphabet.length]).join("");
  return `CREW-${suffix}`;
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

function showPhotoStatus(message) {
  photoStatus.textContent = message;
}

function showDiagnosticStatus(message) {
  diagnosticStatus.textContent = message;
}

function showVisibilityMessage(message) {
  visibilityMessage.textContent = message;
}

function showCrewBoardMessage(message) {
  crewBoardMessage.textContent = message;
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

function getPrimaryUnitLabel(job) {
  if (job.jobType === "Automotive") {
    return [job.year, job.make, job.model].filter(Boolean).join(" ");
  }

  return job.machine;
}

function getPrimaryIdentifier(job) {
  return job.jobType === "Automotive" ? job.vin : job.serial;
}

function getVisibilityLabel(job) {
  return job.visibilityType === "crew" ? "Crew" : "Solo";
}

function getCurrentUserCrewRole(job) {
  return job.crewMembers.find((member) => member.userId === currentUser?.id)?.role || "";
}

function isCurrentUserCrewLead(job) {
  return getCurrentUserCrewRole(job) === "crew_lead";
}

function getCurrentUserCrewRoleLabel(job) {
  const role = getCurrentUserCrewRole(job);

  if (!role && job.createdBy === currentUser?.id) {
    return job.crew ? "Owner" : "Owner, no crew created";
  }

  return formatCrewRole(role) || "Not a member";
}

function canManageCrewJob(job) {
  if (!job) {
    return false;
  }

  if (job.createdBy === currentUser?.id) {
    return true;
  }

  return ["crew_lead", "crew_worker"].includes(getCurrentUserCrewRole(job));
}

function formatCrewRole(role) {
  return {
    crew_lead: "Crew Lead",
    crew_worker: "Crew Worker",
    supervisor: "Supervisor",
  }[role] || "";
}

function renderHeavyMeta(job) {
  return [
    metaItem("Machine", job.machine),
    metaItem("Serial", job.serial),
    metaItem("Customer / location", job.customer),
    metaItem("Hours / miles", job.meter),
  ].join("");
}

function renderAutomotiveMeta(job) {
  return [
    metaItem("Vehicle", [job.year, job.make, job.model].filter(Boolean).join(" ")),
    metaItem("VIN", job.vin),
    metaItem("Mileage", job.mileage),
  ].join("");
}

function renderHeavyNotes(job) {
  return [noteBlock("Complaint", job.complaint), noteBlock("Cause", job.cause), noteBlock("Correction", job.correction)].join("");
}

function renderAutomotiveNotes(job) {
  return [
    noteBlock("Customer concern", job.customerConcern),
    noteBlock("Diagnosis", job.diagnosis),
    noteBlock("Repair performed", job.repairPerformed),
  ].join("");
}

function renderDiagnosticFiles(job) {
  if (!job.diagnosticFiles.length) {
    return "<p>No diagnostic files saved on this job yet.</p>";
  }

  return `
    <div class="diagnostic-list">
      ${job.diagnosticFiles
        .map(
          (file) => `
            <div class="diagnostic-item">
              <div>
                <a href="${file.url}" target="_blank" rel="noopener" download="${escapeHtml(file.fileName)}">
                  ${escapeHtml(file.fileName)}
                </a>
                <span>${escapeHtml(file.fileType || "Other")}</span>
              </div>
              ${
                canManageCrewJob(job) || file.uploadedBy === currentUser?.id
                  ? `<button class="button danger compact-button" type="button" data-diagnostic-id="${file.id}">Delete</button>`
                  : ""
              }
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCrewPanel(job) {
  const canManageJob = canManageCrewJob(job);
  const canManageMembers = isCurrentUserCrewLead(job);
  const members = job.crewMembers.length
    ? job.crewMembers
        .map(
          (member) => `
            <li>
              <span>
                <strong>${escapeHtml(member.displayName)}</strong>
                ${member.email ? `<small>${escapeHtml(member.email)}</small>` : ""}
              </span>
              ${renderCrewMemberRoleControl(member, canManageMembers)}
            </li>
          `,
        )
        .join("")
    : "<li>No crew members have been added yet.</li>";

  return `
    <section class="crew-panel">
      <div class="form-section-title">
        <span>Job Crew</span>
        <p>This crew is attached only to this job and keeps access after completion.</p>
      </div>

      ${
        job.crew
          ? `
            <div class="crew-actions">
              <div>
                <strong>${escapeHtml(job.crew.name || createJobCrewName(job))}</strong>
                <p>Job-specific crew</p>
                <br />
                <strong>Join code</strong>
                <code>${escapeHtml(job.crew.joinCode)}</code>
                <p>Share this code with technicians or supervisors for this specific job.</p>
              </div>
            </div>
          `
          : `
            <div class="crew-actions">
              <div>
                <strong>Create Crew for This Job</strong>
                <p>This creates a job-specific crew and makes you the crew lead.</p>
              </div>
              ${
                canManageJob
                  ? `<button class="button secondary compact-button" type="button" data-action="create-crew">Create crew</button>`
                  : ""
              }
            </div>
          `
      }

      <div class="crew-actions">
        <div>
          <strong>Join Crew for This Job</strong>
          <p>Enter a job-specific join code. New joiners are added as crew workers.</p>
        </div>
        <label>
          Join code
          <input data-join-code type="text" placeholder="JOB-ABC123" />
        </label>
        <button class="button secondary compact-button" type="button" data-action="join-crew">Join crew</button>
      </div>

      <div class="crew-members">
        <strong>Crew Member Management</strong>
        <p>Only crew leads can change roles. Crew workers can edit the job; supervisors are view-only.</p>
        <ul>${members}</ul>
      </div>
    </section>
  `;
}

function renderCrewMemberRoleControl(member, canManageMembers) {
  if (!canManageMembers || member.role === "crew_lead") {
    return `<span class="crew-role">${escapeHtml(formatCrewRole(member.role) || member.role)}</span>`;
  }

  return `
    <label class="member-role-control">
      Role
      <select data-member-role="${member.id}">
        <option value="crew_worker" ${member.role === "crew_worker" ? "selected" : ""}>Crew Worker</option>
        <option value="supervisor" ${member.role === "supervisor" ? "selected" : ""}>Supervisor</option>
      </select>
    </label>
  `;
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
  const typeSpecificLines =
    job.jobType === "Automotive"
      ? [
          `Vehicle: ${[job.year, job.make, job.model].filter(Boolean).join(" ") || "N/A"}`,
          `VIN: ${job.vin || "N/A"}`,
          `Mileage: ${job.mileage || "N/A"}`,
          "",
          `Customer Concern: ${job.customerConcern || "N/A"}`,
          "",
          `Diagnosis: ${job.diagnosis || "N/A"}`,
          "",
          `Repair Performed: ${job.repairPerformed || "N/A"}`,
        ]
      : [
          `Machine: ${job.machine || "N/A"}`,
          `Serial: ${job.serial || "N/A"}`,
          `Hours / Miles: ${job.meter || "N/A"}`,
          "",
          `Complaint: ${job.complaint || "N/A"}`,
          "",
          `Cause: ${job.cause || "N/A"}`,
          "",
          `Correction: ${job.correction || "N/A"}`,
        ];

  return [
    `Job: ${job.title}`,
    `Job Type: ${job.jobType}`,
    `Visibility: ${getVisibilityLabel(job)}`,
    `Status: ${job.status}`,
    `Work Order: ${job.workOrder || "N/A"}`,
    `Date: ${formatDate(job.jobDate) || "N/A"}`,
    `Customer Name: ${job.customerName || "N/A"}`,
    `Customer Phone: ${job.customerPhone || "N/A"}`,
    `Customer Email: ${job.customerEmail || "N/A"}`,
    ...typeSpecificLines,
    "",
    `Summary: ${job.summary || "N/A"}`,
    "",
    `Parts / Fluids / Tooling: ${job.parts || "N/A"}`,
    "",
    ...(job.jobType === "Heavy" ? [`Diagnostic files attached in IronProof: ${job.diagnosticFiles.length}`, ""] : []),
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

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.body.classList.toggle("dark", nextTheme === "dark");
  document.body.classList.toggle("light", nextTheme === "light");
  themeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === nextTheme);
  });
}

async function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  applyTheme(nextTheme);

  if (!currentUser || !supabaseClient) {
    return;
  }

  currentProfile = { ...(currentProfile || {}), theme: nextTheme };

  const { error } = await supabaseClient
    .from("profiles")
    .update({ theme: nextTheme })
    .eq("id", currentUser.id);

  if (error) {
    setAuthMessage(`Theme save failed: ${error.message}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
