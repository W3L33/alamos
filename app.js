const container = document.getElementById("container");
const title = document.getElementById("title");
const backBtn = document.getElementById("backBtn");
const themeToggle = document.getElementById("themeToggle");

function renderCountries() {
  container.innerHTML = "";
  title.textContent = "Países";
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
  title.textContent = country;
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