import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const username = process.env.GITHUB_USERNAME || "LucioZampella";
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "github-profile-language-chart",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.json();
}

async function allRepositories() {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=100&page=${page}`);
    repositories.push(...batch);
    if (batch.length < 100) return repositories;
  }
}

function escapeXml(value) {
  return String(value).replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character]);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

const repositories = (await allRepositories()).filter((repo) => !repo.fork && !repo.archived);
const languages = new Map();

await Promise.all(repositories.map(async (repo) => {
  const data = await github(`/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/languages`);
  for (const [language, bytes] of Object.entries(data)) {
    languages.set(language, (languages.get(language) || 0) + bytes);
  }
}));

const top = [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
const total = [...languages.values()].reduce((sum, bytes) => sum + bytes, 0);
const max = top[0]?.[1] || 1;
const colors = ["#97FF5B", "#b5ff8a", "#d5ffba", "#e4e4e4", "#9ca3a0", "#7a817d", "#64706a", "#4f5d55", "#3d4a42", "#2e3933"];
const rows = top.map(([language, bytes], index) => {
  const y = 112 + index * 31;
  const width = Math.round((bytes / max) * 465);
  const percentage = total ? ((bytes / total) * 100).toFixed(1) : "0.0";
  return `\n  <text x="38" y="${y + 15}" class="label">${escapeXml(language)}</text>\n  <rect x="215" y="${y}" width="465" height="18" rx="9" class="track"/>\n  <rect x="215" y="${y}" width="${width}" height="18" rx="9" fill="${colors[index]}"/>\n  <text x="700" y="${y + 15}" class="value">${percentage}% · ${formatBytes(bytes)}</text>`;
}).join("");

const languagesSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="450" viewBox="0 0 900 450" role="img" aria-labelledby="title description">
  <title id="title">Top 10 programming languages</title>
  <desc id="description">Language composition across ${repositories.length} public non-fork repositories owned by ${escapeXml(username)}.</desc>
  <style>
    .title { font: 700 25px Arial, sans-serif; fill: #97FF5B; }
    .subtitle { font: 14px Arial, sans-serif; fill: #E4E4E4; opacity: .75; }
    .label { font: 600 14px Arial, sans-serif; fill: #E4E4E4; }
    .value { font: 12px Arial, sans-serif; fill: #E4E4E4; opacity: .82; text-anchor: end; }
    .track { fill: #5a5a5a; }
  </style>
  <rect width="900" height="450" rx="18" fill="#444444"/>
  <text x="38" y="52" class="title">TOP 10 PROGRAMMING LANGUAGES</text>
  <text x="38" y="78" class="subtitle">Based on language bytes across ${repositories.length} public repositories · refreshed daily</text>${rows}
</svg>`;

const stars = repositories.reduce((sum, repository) => sum + repository.stargazers_count, 0);
const forks = repositories.reduce((sum, repository) => sum + repository.forks_count, 0);
const updated = new Date().toISOString().slice(0, 10);
const overviewSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="245" viewBox="0 0 900 245" role="img" aria-labelledby="title description">
  <title id="title">GitHub profile overview</title>
  <desc id="description">Public repository overview for ${escapeXml(username)}, generated on ${updated}.</desc>
  <style>
    .title { font: 700 25px Arial, sans-serif; fill: #97FF5B; }
    .subtitle { font: 14px Arial, sans-serif; fill: #E4E4E4; opacity: .75; }
    .metric { font: 700 38px Arial, sans-serif; fill: #97FF5B; }
    .label { font: 600 13px Arial, sans-serif; fill: #E4E4E4; letter-spacing: 1px; }
    .detail { font: 12px Arial, sans-serif; fill: #E4E4E4; opacity: .68; }
  </style>
  <rect width="900" height="245" rx="18" fill="#444444"/>
  <text x="38" y="52" class="title">GITHUB OVERVIEW</text>
  <text x="38" y="78" class="subtitle">Public work by ${escapeXml(username)} · refreshed daily</text>
  <rect x="38" y="108" width="194" height="103" rx="12" fill="#515151"/>
  <rect x="251" y="108" width="194" height="103" rx="12" fill="#515151"/>
  <rect x="464" y="108" width="194" height="103" rx="12" fill="#515151"/>
  <rect x="677" y="108" width="185" height="103" rx="12" fill="#515151"/>
  <text x="58" y="153" class="metric">${repositories.length}</text><text x="58" y="181" class="label">REPOSITORIES</text>
  <text x="271" y="153" class="metric">${languages.size}</text><text x="271" y="181" class="label">LANGUAGES</text>
  <text x="484" y="153" class="metric">${stars}</text><text x="484" y="181" class="label">STARS</text>
  <text x="697" y="153" class="metric">${forks}</text><text x="697" y="181" class="label">FORKS</text>
</svg>`;

mkdirSync("assets", { recursive: true });
writeFileSync("assets/github-languages.svg", languagesSvg);
writeFileSync("assets/github-overview.svg", overviewSvg);
