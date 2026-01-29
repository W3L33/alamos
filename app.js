const container = document.getElementById("container");
const backBtn = document.getElementById("backBtn");
const themeToggle = document.getElementById("themeToggle");

const titleText = document.getElementById("titleText");
const titleFlag = document.getElementById("titleFlag");

/*PRELOAD DE FONDOS */
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
function renderCountries() {
  container.innerHTML = "";
  titleText.textContent = "Países";
  titleFlag.classList.add("hidden");
  backBtn.classList.add("hidden");

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
  container.innerHTML = "";
  titleText.textContent = country;
  titleFlag.src = data[country].image;
  titleFlag.classList.remove("hidden");
  backBtn.classList.remove("hidden");

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

backBtn.onclick = renderCountries;

themeToggle.onclick = () => {
  const icon = themeToggle.querySelector("i");
  document.body.classList.toggle("night");
  document.body.classList.toggle("day");

  icon.className = document.body.classList.contains("night")
    ? "fa-solid fa-sun"
    : "fa-solid fa-moon";
};

renderCountries();