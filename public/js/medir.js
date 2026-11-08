// Fluxo de medição da página /medir: câmera (simulada) + balança (ESP32 que grava o peso no SKU pela API).
(function () {
  const $ = (id) => document.getElementById(id);
  const btnMedir = $("btnMedir");
  if (!btnMedir) return;

  const btnBalanca = $("btnBalanca");
  const labelBalanca = btnBalanca.innerHTML; // para restaurar depois da espera
  const btnSalvar = $("btnSalvarMedicao");

  const rnd = (a, b, dec = 0) => {
    const v = a + Math.random() * (b - a);
    return dec ? +v.toFixed(dec) : Math.round(v);
  };
  const brl = (v) => "R$ " + Number(v).toFixed(2).replace(".", ",");
  const numv = (id) => parseFloat(String($(id).value).replace(",", "."));
  const esc = (s) => String(s).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));

  // --- Câmera: mede L/A/C ---
  btnMedir.addEventListener("click", function () {
    const scanner = $("medScanner");
    const status = $("medScanStatus");
    scanner.classList.remove("done");
    scanner.classList.add("scanning");
    status.textContent = "Medindo…";
    btnMedir.disabled = true;
    setTimeout(function () {
      $("medL").value = rnd(10, 40);
      $("medA").value = rnd(5, 30);
      $("medC").value = rnd(12, 50);
      scanner.classList.remove("scanning");
      scanner.classList.add("done");
      status.textContent = "Dimensões capturadas";
      btnMedir.disabled = false;
    }, 1800);
  });

  // --- Balança: espera o ESP32 (físico ou simulado no Wokwi) gravar o peso no SKU ---
  // O ESP32 envia o peso para POST /api/iot/medidas. Aqui lemos o peso do SKU ao clicar e
  // consultamos até ele mudar. Por isso: clique em "conectar" ANTES de pesar o produto.
  // Limitação: uma pesagem com o mesmo valor da anterior não é percebida.
  let scaleJob = null; // existe enquanto aguarda; um novo clique cancela

  async function fetchPeso(sku) {
    const r = await fetch("/medir/peso?sku=" + encodeURIComponent(sku));
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || "Falha ao consultar o peso.");
    return data.pesoReal; // número ou null
  }

  btnBalanca.addEventListener("click", async function () {
    if (scaleJob) { scaleJob.cancelled = true; return; }

    const sku = $("medSku").value.trim();
    if (!sku) { alert("Informe o SKU antes de pesar: a balança grava o peso nesse SKU."); return; }

    const scale = $("medScale");
    const status = $("medScaleStatus");
    const valEl = $("medScaleValue");
    const job = { cancelled: false };
    scaleJob = job;

    scale.classList.remove("done");
    scale.classList.add("scanning");
    valEl.textContent = "…";
    status.textContent = "Lendo o peso atual do SKU…";
    btnBalanca.innerHTML = '<i class="bi bi-x-circle"></i> Cancelar espera';

    try {
      const antes = await fetchPeso(sku);
      status.textContent = "Aguardando a balança… coloque o produto";

      const limite = Date.now() + 60000;
      let peso = null;
      while (!job.cancelled && Date.now() < limite) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (job.cancelled) break;
        try {
          const atual = await fetchPeso(sku);
          if (atual != null && atual !== antes) { peso = atual; break; }
        } catch (_) { /* falha momentânea de rede: tenta de novo */ }
      }

      if (job.cancelled) {
        status.textContent = "Espera cancelada";
        valEl.textContent = "—";
      } else if (peso == null) {
        status.textContent = "Nenhuma pesagem nova chegou";
        valEl.textContent = "—";
        alert("Nenhuma pesagem nova chegou. Confira se o SKU na balança é o mesmo e se o peso é diferente do anterior.");
      } else {
        const txt = String(peso).replace(".", ",");
        $("medPeso").value = txt;
        valEl.textContent = txt + " kg";
        scale.classList.add("done");
        status.textContent = "Peso recebido";
      }
    } catch (e) {
      status.textContent = "Balança indisponível";
      valEl.textContent = "—";
      alert(e.message);
    } finally {
      scale.classList.remove("scanning");
      scaleJob = null;
      btnBalanca.innerHTML = labelBalanca;
    }
  });

  // --- Salvar + comparar ---
  btnSalvar.addEventListener("click", async function () {
    const sku = $("medSku").value.trim();
    if (!sku) { alert("Informe o SKU do produto."); return; }
    if (!(numv("medL") > 0 && numv("medA") > 0 && numv("medC") > 0 && numv("medPeso") > 0)) {
      alert("Preencha as dimensões e o peso (meça ou digite).");
      return;
    }
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando…';
    try {
      const r = await fetch("/produtos/medidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          largura: $("medL").value,
          altura: $("medA").value,
          comprimento: $("medC").value,
          pesoReal: $("medPeso").value,
        }),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "falha");
      renderResult(data, sku);
    } catch (e) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = '<i class="bi bi-check2-circle"></i> Calcular e salvar';
    }
  });

  function kpi(label, val) {
    return '<div class="col"><div class="kpi-label">' + label + "</div><div class=\"fw-bold fs-5\">" + val + "</div></div>";
  }

  function renderResult(data, sku) {
    const res = $("medResult");
    const body = $("medResultBody");
    const l = numv("medL"), a = numv("medA"), c = numv("medC"), p = numv("medPeso");
    const cub = (l * a * c) / 6000;
    const cons = Math.max(p, cub);

    let html = '<div class="fw-semibold mb-2"><i class="bi bi-rulers text-primary"></i> Resultado — SKU ' + esc(sku) + "</div>";
    html += '<div class="row text-center g-2 mb-2">';
    html += kpi("Cubagem", cub.toFixed(3).replace(".", ",") + " kg");
    html += kpi("Peso considerado", cons.toFixed(3).replace(".", ",") + " kg");
    html += "</div>";

    const cmp = data.comparacao;
    if (data.afetados === 0) {
      html += '<div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle"></i> Nenhum anúncio com o SKU <strong>' + esc(sku) + "</strong>. As medidas não foram vinculadas — escolha um SKU existente.</div>";
    } else if (!cmp || cmp.freteCobrado == null) {
      html += '<div class="alert alert-secondary mb-0">Medidas salvas em <strong>' + data.afetados + "</strong> anúncio(s). Ainda sem frete cobrado para comparar (rode um <strong>Atualizar</strong> em Anúncios).</div>";
    } else {
      const delta = cmp.delta;
      html += '<div class="row text-center g-2">';
      html += kpi("Frete cobrado", brl(cmp.freteCobrado));
      html += kpi("Frete real", brl(cmp.freteReal));
      html += "</div>";
      html += '<div class="text-center mt-3">';
      if (cmp.divergente) {
        const dir = delta > 0 ? "acima" : "abaixo";
        html += '<span class="badge text-bg-danger fs-6"><i class="bi bi-exclamation-triangle"></i> Frete divergente — real ' + dir + " do cobrado em " + brl(Math.abs(delta)) + "</span>";
      } else {
        html += '<span class="badge text-bg-success fs-6"><i class="bi bi-check-circle"></i> Frete coerente (Δ ' + brl(Math.abs(delta)) + ")</span>";
      }
      html += "</div>";
      html += '<p class="text-muted small text-center mt-2 mb-0">Aplicado a ' + data.afetados + ' anúncio(s) do SKU. Veja todos em <a href="/produtos">Produtos</a>.</p>';
    }
    body.innerHTML = html;
    res.classList.remove("d-none");
    res.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
})();