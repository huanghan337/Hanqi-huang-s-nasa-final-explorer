/*
  script.js
  - Reads window.APOD_FEED_URL (default to local data.json)
  - Fetches array of APOD-like objects
  - Filters by date range (YYYY-MM-DD string compare)
  - Displays image thumbnails or video embeds/thumbnail/link
  - Has retry/backoff and clear error messaging
*/
const FEED_URL = window.APOD_FEED_URL || "data.json";

const factList = [
  "A day on Venus is longer than a year on Venus.",
  "Neutron stars can spin hundreds of times per second.",
  "There are more trees on Earth than stars in the Milky Way (estimated).",
  "The International Space Station travels at about 28,000 km/h.",
  "Light from the Sun takes about 8 minutes to reach Earth."
];

function pickFact(){ const el=document.getElementById("factBox"); if(el) el.textContent = "Did you know? " + factList[Math.floor(Math.random()*factList.length)]; }
function isoToday(){ return new Date().toISOString().slice(0,10); }
function daysBefore(days){ const d=new Date(); d.setDate(d.getDate()-days); return d.toISOString().slice(0,10); }

// simple retry fetch with exponential backoff
async function fetchWithRetry(url, attempts = 3, baseDelay = 400){
  let lastErr;
  for(let i=0;i<attempts;i++){
    try{
      const resp = await fetch(url, {cache: "no-cache"});
      if(!resp.ok) throw new Error("HTTP "+resp.status+" "+resp.statusText);
      return resp;
    }catch(err){
      lastErr = err;
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(r=>setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function fetchAPODArray(){
  const gallery = document.getElementById("gallery");
  try{
    const resp = await fetchWithRetry(FEED_URL, 3, 300);
    const data = await resp.json();
    if(!Array.isArray(data)) throw new Error("Feed did not return an array");
    return data;
  }catch(err){
    console.error("Feed fetch error:", err);
    if(gallery) gallery.innerHTML = '<p style="color:crimson">Error fetching feed: ' + err.message + '</p>';
    return [];
  }
}

function formatDate(d){ return (d||"").slice(0,10); }

// Create thumbnail card
function createThumb(item){
  const div = document.createElement("div");
  div.className = "gallery-item";

  const mediaWrap = document.createElement("div");

  if(item.media_type === "image"){
    const img = document.createElement("img");
    img.src = item.hdurl || item.url;
    img.alt = item.title || "APOD image";
    mediaWrap.appendChild(img);
  } else if(item.media_type === "video"){
    // Prefer embedding if it's an embeddable youtube link (contains /embed/), else show thumbnail if available, else a link
    if(item.url && (item.url.includes("youtube.com/embed") || item.url.includes("youtube.com/watch") || item.url.includes("youtu.be"))){
      // If url is a watch?v= form, convert to embed
      let embedUrl = item.url;
      if(item.url.includes("watch?v=")) embedUrl = item.url.replace("watch?v=","embed/");
      if(item.url.includes("youtu.be/")) embedUrl = item.url.replace("youtu.be/","www.youtube.com/embed/");
      const iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
      iframe.loading = "lazy";
      iframe.title = item.title || "APOD video";
      mediaWrap.appendChild(iframe);
    } else if(item.thumbnail_url){
      const img = document.createElement("img");
      img.src = item.thumbnail_url;
      img.alt = item.title || "APOD video thumbnail";
      img.loading = "lazy";
      mediaWrap.appendChild(img);
    } else {
      const a = document.createElement("a");
      a.href = item.url || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Open video";
      mediaWrap.appendChild(a);
    }
  } else {
    const p = document.createElement("p");
    p.textContent = "Unsupported media";
    mediaWrap.appendChild(p);
  }

  const title = document.createElement("p");
  title.className = "thumb-title";
  title.textContent = item.title || "";

  const date = document.createElement("p");
  date.className = "thumb-date";
  date.textContent = formatDate(item.date);

  div.appendChild(mediaWrap);
  div.appendChild(title);
  div.appendChild(date);

  div.addEventListener("click", ()=> openModal(item));

  return div;
}

function openModal(item){
  const modal = document.getElementById("modal");
  if(modal) modal.setAttribute("aria-hidden","false");
  const mt = document.getElementById("modalTitle");
  if(mt) mt.textContent = item.title || "";
  const md = document.getElementById("modalDate");
  if(md) md.textContent = formatDate(item.date);
  const me = document.getElementById("modalExplanation");
  if(me) me.textContent = item.explanation || "";

  const mediaEl = document.getElementById("modalMedia");
  mediaEl.innerHTML = "";
  if(item.media_type === "image"){
    const img = document.createElement("img");
    img.src = item.hdurl || item.url;
    img.alt = item.title || "";
    mediaEl.appendChild(img);
  } else if(item.media_type === "video"){
    if(item.url && (item.url.includes("youtube.com") || item.url.includes("youtu.be"))){
      let embedUrl = item.url;
      if(item.url.includes("watch?v=")) embedUrl = item.url.replace("watch?v=","embed/");
      if(item.url.includes("youtu.be/")) embedUrl = item.url.replace("youtu.be/","www.youtube.com/embed/");
      const iframe = document.createElement("iframe");
      iframe.src = embedUrl;
      iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
      iframe.setAttribute("allowfullscreen","");
      mediaEl.appendChild(iframe);
    } else if(item.thumbnail_url){
      const img = document.createElement("img");
      img.src = item.thumbnail_url;
      img.alt = item.title || "";
      mediaEl.appendChild(img);
      const a = document.createElement("a");
      a.href = item.url || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Open video in new tab";
      mediaEl.appendChild(a);
    } else {
      const a = document.createElement("a");
      a.href = item.url || "#";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Open video in new tab";
      mediaEl.appendChild(a);
    }
  } else {
    mediaEl.textContent = "Unsupported media type";
  }
}

function closeModal(){
  const modal = document.getElementById("modal");
  if(modal) modal.setAttribute("aria-hidden","true");
  const mediaEl = document.getElementById("modalMedia");
  if(mediaEl) mediaEl.innerHTML = "";
}

document.addEventListener("DOMContentLoaded", async ()=>{
  pickFact();
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  if(endInput) endInput.value = isoToday();
  if(startInput) startInput.value = daysBefore(6);

  const fetchBtn = document.getElementById("fetchBtn");
  const gallery = document.getElementById("gallery");

  async function runFetch(){
    if(gallery) gallery.innerHTML = "<p>Loading...</p>";
    const items = await fetchAPODArray();
    if(!items || items.length === 0){
      if(gallery) gallery.innerHTML = "<p style=\"color:crimson\">No entries available in feed.</p>";
      return;
    }
    // filter by date (string compare yyyy-mm-dd)
    const start = startInput ? startInput.value : isoToday();
    const end = endInput ? endInput.value : isoToday();
    const filtered = items.filter(it => {
      if(!it.date) return false;
      const ds = it.date.slice(0,10);
      return ds >= start && ds <= end;
    }).sort((a,b)=> b.date.localeCompare(a.date));

    if(!filtered || filtered.length === 0){
      if(gallery) gallery.innerHTML = "<p style=\"color:crimson\">No APOD entries found for this range.</p>";
      return;
    }

    if(gallery) gallery.innerHTML = "";
    filtered.forEach(it => gallery.appendChild(createThumb(it)));
  }

  if(fetchBtn) fetchBtn.addEventListener("click", runFetch);

  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", (e)=> { if(e.target.id === "modal") closeModal(); });

  // initial load
  if(fetchBtn) fetchBtn.click();
});
