const storageKey = "ironproof-diesel-jobs";
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

let jobs = loadJobs();
let activeFilter = "All";
let activeJobId = jobs[0]?.id || null;
let editingJobId = null;
let stagedPhotos = [];

setDefaultDate();
render();

photoInput.addEventListener("change", async (event) => {
  stagedPhotos = await readPhotos([...event.target.files]);
  renderPhotoPreview(stagedPhotos);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const job = {
    id: editingJobId || createId(),
    createdAt: editingJobId ? getJob(editingJobId).createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: getValue(formData, "title"),
    status: getValue(formData, "status") || "Open",
    workOrder: getValue(formData, "workOrder"),
    jobDate: getValue(formData, "jobDate"),
    machine: getValue(formData, "machine"),
    serial: getValue(formData, "serial"),
    customer: getValue(formData, "customer"),
    meter: getValue(formData, "meter"),
    summary: getValue(formData, "summary"),
    complaint: getValue(formData, "complaint"),
    cause: getValue(formData, "cause"),
    correction: getValue(formData, "correction"),
    parts: getValue(formData, "parts"),
    photos: editingJobId ? [...getJob(editingJobId).photos, ...stagedPhotos] : stagedPhotos,
  };

  if (editingJobId) {
    jobs = jobs.map((savedJob) => (savedJob.id === editingJobId ? job : savedJob));
  } else {
    jobs = [job, ...jobs];
  }

  activeJobId = job.id;
  if (!saveJobs()) {
    return;
  }

  resetForm();
  render();
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

function loadJobs() {
  const savedJobs = localStorage.getItem(storageKey);

  if (savedJobs) {
    try {
      return JSON.parse(savedJobs);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  return [
    {
      id: createId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: "336 Excavator hydraulic leak",
      status: "Diagnosing",
      workOrder: "WO-10482",
      jobDate: new Date().toISOString().slice(0, 10),
      machine: "Cat 336 Excavator",
      serial: "CAT0336EJHDK11234",
      customer: "North Yard",
      meter: "6,812 hrs",
      summary: "Customer reported hydraulic oil leaking near the boom foot after loading trucks.",
      complaint: "Hydraulic leak visible after machine warms up. Operator said boom drifted overnight.",
      cause: "Initial inspection found wet oil trail near boom cylinder hose fitting. Needs pressure wash and recheck.",
      correction: "Documented leak area, tagged machine, and requested hose quote before disassembly.",
      parts: "Possible boom cylinder hose, hydraulic oil top-off, caps/plugs.",
      photos: [],
    },
  ];
}

function saveJobs() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(jobs));
    return true;
  } catch {
    alert("This browser is out of storage. Try removing a few photos from older jobs before saving more.");
    return false;
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
            ? job.photos.map((photo) => `<img src="${photo.data}" alt="${escapeHtml(photo.name)}" />`).join("")
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

function deleteJob(jobId) {
  const job = getJob(jobId);
  const confirmed = confirm(`Delete "${job.title}"? This only removes it from this browser.`);

  if (!confirmed) {
    return;
  }

  jobs = jobs.filter((savedJob) => savedJob.id !== jobId);
  activeJobId = jobs[0]?.id || null;
  if (!saveJobs()) {
    return;
  }

  resetForm();
  render();
}

function resetForm() {
  form.reset();
  editingJobId = null;
  stagedPhotos = [];
  submitButton.textContent = "Save job";
  photoInput.value = "";
  renderPhotoPreview(stagedPhotos);
  setDefaultDate();
}

async function readPhotos(files) {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  const readers = imageFiles.map(
    (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          resizePhoto(reader.result, file.name).then(resolve);
        });
        reader.readAsDataURL(file);
      }),
  );

  return Promise.all(readers);
}

function resizePhoto(source, name) {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const maxSize = 1400;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      resolve({
        name,
        type: "image/jpeg",
        data: canvas.toDataURL("image/jpeg", 0.78),
      });
    });
    image.src = source;
  });
}

function renderPhotoPreview(photos) {
  photoPreview.innerHTML = photos
    .map((photo) => `<img src="${photo.data}" alt="${escapeHtml(photo.name)}" />`)
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
