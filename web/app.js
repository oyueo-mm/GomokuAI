"use strict";
const byId = id => document.getElementById(id);
const canvas = byId("board");
const context = canvas.getContext("2d");
let game = null;
let sessionId = null;
let busy = false;
let heatmap = [];
const cells = 680;
const pad = 39;
const area = cells - 2 * pad;

async function request(path, payload) {
  const response = await fetch(path, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
  let result;
  try {result = await response.json();} catch {throw new Error("서버 응답을 읽을 수 없습니다.");}
  if (!response.ok) throw new Error(result.error || "요청 실패");
  return result;
}

function stoneAt(row, col) {
  return {x: pad + col * area / (game.size - 1), y: pad + row * area / (game.size - 1)};
}

function draw() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = cells * pixelRatio;
  canvas.height = cells * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const gradient = context.createLinearGradient(0, 0, cells, cells);
  gradient.addColorStop(0, "#efc58c");
  gradient.addColorStop(1, "#d9a368");
  context.fillStyle = gradient;
  context.fillRect(0, 0, cells, cells);
  if (!game) {context.fillStyle = "#604729"; context.textAlign = "center"; context.font = "bold 26px sans-serif"; context.fillText("새 대국을 시작하세요", cells / 2, cells / 2); return;}
  const spacing = area / (game.size - 1);
  context.lineWidth = Math.max(1, 1.15 * 15 / game.size);
  context.strokeStyle = "rgba(70, 48, 26, .8)";
  for (let i = 0; i < game.size; i++) {
    let p = pad + i * spacing;
    context.beginPath(); context.moveTo(pad, p); context.lineTo(cells - pad, p); context.stroke();
    context.beginPath(); context.moveTo(p, pad); context.lineTo(p, cells - pad); context.stroke();
  }
  let marks = game.size === 9 ? [2, 4, 6] : game.size === 13 ? [3, 6, 9] : [3, 7, 11];
  for (let row of marks) for (let col of marks) {const {x, y} = stoneAt(row, col); context.beginPath(); context.arc(x, y, game.size === 9 ? 5 : 3.7, 0, Math.PI * 2); context.fillStyle = "#65472c"; context.fill();}
  if (byId("showHeatmap").checked && !game.done) {
    heatmap.slice(0, 10).forEach((p, i) => {
      const {x, y} = stoneAt(p.row, p.col);
      context.beginPath(); context.arc(x, y, spacing * .42, 0, Math.PI * 2);
      context.fillStyle = `rgba(24, 105, 118, ${.36 - i * .021})`; context.fill();
      context.fillStyle = "#f3fbfa"; context.textAlign = "center"; context.font = `${Math.max(10, Math.floor(spacing * .24))}px sans-serif`;
      context.fillText(`${i + 1}`, x, y + 4);
    });
  }
  for (let row = 0; row < game.size; row++) for (let col = 0; col < game.size; col++) {
    const player = game.board[row][col]; if (!player) continue;
    const {x, y} = stoneAt(row, col);
    context.save(); context.shadowColor = "#25190c99"; context.shadowBlur = 5; context.shadowOffsetY = 2;
    const radius = Math.min(spacing * .43, 23); const stone = context.createRadialGradient(x - radius / 3, y - radius / 3, 2, x, y, radius);
    if (player === 1) {stone.addColorStop(0, "#4b535a"); stone.addColorStop(1, "#090c12");} else {stone.addColorStop(0, "#ffffff"); stone.addColorStop(1, "#ccd5d8");}
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fillStyle = stone; context.fill(); context.restore();
  }
  if (game.last_move) {const [row, col] = game.last_move; const {x, y} = stoneAt(row, col); context.strokeStyle = game.board[row][col] === 1 ? "#e9b276" : "#b36933"; context.lineWidth = 2.5; context.beginPath(); context.arc(x, y, Math.max(5, spacing * .16), 0, Math.PI * 2); context.stroke();}
}

function updateUI() {
  if (!game) return;
  const humanBlack = game.human_color === 1;
  byId("blackName").textContent = humanBlack ? "흑 · 사람" : "흑 · AI";
  byId("whiteName").textContent = humanBlack ? "백 · AI" : "백 · 사람";
  byId("moveCount").textContent = `${game.version}수 진행`;
  if (game.done) byId("status").textContent = game.winner === null ? "무승부" : game.winner === game.human_color ? "승리! 다시 도전해 보세요." : "AI 승리 · 다시 도전해 보세요.";
  else byId("status").textContent = "당신 차례 · 교차점을 클릭하세요";
  byId("nodes").textContent = game.last_ai ? game.last_ai.nodes.toLocaleString() : "—";
  byId("duration").textContent = game.last_ai ? `${(game.last_ai.seconds * 1000).toFixed(1)} ms` : "—";
  byId("aiTime").textContent = game.last_ai ? `AI: ${game.last_ai.algorithm}` : "AI 연산: —";
  byId("history").innerHTML = game.history.length ? game.history.map((move, i) => `<span class="move ${move.by === "ai" ? "ai" : ""}">${i + 1}. ${String.fromCharCode(65 + move.col)}${move.row + 1}</span>`).join("") : '<span class="placeholder">아직 착수 기록이 없습니다.</span>';
  byId("history").scrollTop = byId("history").scrollHeight;
  draw();
}

async function refreshAnalysis() {
  if (!sessionId || !game || game.done) {heatmap = []; byId("candidates").textContent = "현재 후보 없음"; draw(); return;}
  const result = await request("/api/analysis", {session: sessionId});
  heatmap = result.positions;
  const top = heatmap.slice(0, 5);
  const min = Math.min(...top.map(x => x.heuristic_score));
  const max = Math.max(...top.map(x => x.heuristic_score));
  byId("candidates").innerHTML = top.map((p, i) => {
    const percent = max === min ? 100 - i * 10 : 25 + 75 * (p.heuristic_score - min) / (max - min);
    return `<div class="candidate"><small>#${p.rank} ${String.fromCharCode(65 + p.col)}${p.row + 1}</small><div class="bar"><div class="fill" style="width:${percent}%"></div></div><div class="value">${Math.round(p.heuristic_score)}</div></div>`;
  }).join("") || '<div class="placeholder">후보 수 없음</div>';
  draw();
}

async function startGame() {
  if (busy) return;
  busy = true; byId("newGame").disabled = true;
  try {
    const result = await request("/api/start", {size: Number(byId("boardSize").value), algorithm: byId("algorithm").value, human_color: Number(byId("humanColor").value), depth: Number(byId("depth").value)});
    sessionId = result.session; game = result; heatmap = [];
    updateUI(); await refreshAnalysis();
  } catch (error) {alert(error.message);} finally {busy = false; byId("newGame").disabled = false;}
}

async function boardClick(event) {
  if (busy || !sessionId || !game || game.done) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * cells / rect.width;
  const y = (event.clientY - rect.top) * cells / rect.height;
  const col = Math.round((x - pad) / (area / (game.size - 1)));
  const row = Math.round((y - pad) / (area / (game.size - 1)));
  if (row < 0 || col < 0 || row >= game.size || col >= game.size || game.board[row][col] !== 0) return;
  busy = true; byId("status").textContent = "AI가 생각 중입니다...";
  try {game = await request("/api/move", {session: sessionId, row, col, version: game.version}); updateUI(); await refreshAnalysis();}
  catch (error) {byId("status").textContent = error.message;}
  finally {busy = false;}
}

byId("newGame").addEventListener("click", startGame);
byId("algorithm").addEventListener("change", () => byId("depthField").classList.toggle("hidden", byId("algorithm").value !== "alphabeta"));
byId("showHeatmap").addEventListener("change", draw);
canvas.addEventListener("click", boardClick);
(async () => {try {await fetch("/api/info").then(r => {if (!r.ok) throw new Error();}); byId("connection").textContent = "● 로컬 엔진 연결됨"; await startGame();} catch {byId("connection").textContent = "● 서버 연결 안 됨"; draw();}})();
