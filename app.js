const container = document.getElementById("container");
const backBtn = document.getElementById("backBtn");
const themeToggle = document.getElementById("themeToggle");

const titleText = document.getElementById("titleText");
const titleFlag = document.getElementById("titleFlag");

/* PRELOAD DE FONDOS */
function preloadImages(urls) {
  urls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
}

preloadImages([
  "alamosday.jpg",
  "alamosnight.jpg"
]);

/* ===== ESTADO ===== */
let isInCountryView = false;

/* ===== SWIPE ===== */
let touchStartX = 0;
let touchEndX = 0;

function handleSwipe() {
  const deltaX = touchEndX - touchStartX;

  if (deltaX > 80 && isInCountryView) {
    renderCountries(true);
  }
}

document.addEventListener("touchstart", e => {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener("touchend", e => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

function renderCountries(animate = false) {
  isInCountryView = false;

  container.innerHTML = "";
  titleText.textContent = "Países";
  titleFlag.classList.add("hidden");
  backBtn.classList.add("hidden");

  titleText.classList.remove("title-animate");
  titleFlag.classList.remove("title-animate");

  if (animate) {
    void titleText.offsetWidth;
    titleText.classList.add("title-animate");
  }

  for (const country in data) {
    const btn = document.createElement("button");
    btn.className = "glass-btn country-btn";

    btn.innerHTML = `
      <span>${country}</span>
      <img src="${data[country].image}" class="card-img">
    `;

    btn.onclick = () => renderTeams(country);
    container.appendChild(btn);
  }
}

function renderTeams(country) {
  isInCountryView = true;

  container.innerHTML = "";
  titleText.textContent = country;
  titleFlag.src = data[country].image;
  titleFlag.classList.remove("hidden");
  backBtn.classList.remove("hidden");

  titleText.classList.remove("title-animate");
  titleFlag.classList.remove("title-animate");

  void titleText.offsetWidth;

  titleText.classList.add("title-animate");
  titleFlag.classList.add("title-animate");

  const teams = data[country].teams;

  for (const team in teams) {
    const btn = document.createElement("button");
    btn.className = "glass-btn country-btn";

    btn.innerHTML = `
      <span>${team}</span>
      <img src="${teams[team].image}" class="card-img">
    `;

    btn.onclick = () => {
      window.open(teams[team].link, "_blank", "noopener,noreferrer");
    };

    container.appendChild(btn);
  }
}

backBtn.onclick = () => renderCountries(true);

themeToggle.onclick = () => {
  const icon = themeToggle.querySelector("i");
  document.body.classList.toggle("night");
  document.body.classList.toggle("day");

  icon.className = document.body.classList.contains("night")
    ? "fa-solid fa-sun"
    : "fa-solid fa-moon";
};

/* animar título inicial */
renderCountries(true);