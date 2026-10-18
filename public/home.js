/* Carousel foto di halaman /home: geser kiri/kanan, jalan sendiri tiap beberapa detik. */
(function () {
  var DELAY = 4000, // jeda antar foto (ms): ubah angka ini untuk lebih cepat/lambat
    RESUME = 3000, // lanjut jalan sendiri setelah pengunjung berhenti menyentuh (ms)
    tr = document.getElementById("tr"),
    dt = document.getElementById("dt"),
    n = tr.children.length,
    cur = 0,
    timer = null,
    resume = null,
    vis = true,
    reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

  for (var i = 0; i < n; i++) dt.appendChild(document.createElement("i"));

  function mark() {
    cur = Math.round(tr.scrollLeft / tr.clientWidth);
    for (var i = 0; i < n; i++)
      dt.children[i].className = i == cur ? "on" : "";
  }
  function go(k) {
    var wrap = k >= n || k < 0; // dari foto terakhir kembali ke pertama: langsung, tanpa memutar balik
    cur = (k + n) % n;
    tr.scrollTo({
      left: cur * tr.clientWidth,
      behavior: reduce || wrap ? "auto" : "smooth",
    });
  }

  // auto scroll
  function stop() {
    clearInterval(timer);
    timer = null;
  }
  function play() {
    stop();
    if (reduce || n < 2) return;
    timer = setInterval(function () {
      if (vis && !document.hidden) go(cur + 1);
    }, DELAY);
  }
  function later() {
    clearTimeout(resume);
    resume = setTimeout(play, RESUME);
  }
  function hold() {
    stop();
    clearTimeout(resume);
  }

  tr.addEventListener("scroll", function () {
    clearTimeout(tr._t);
    tr._t = setTimeout(mark, 60);
  });
  // berhenti selama disentuh/dipegang, lanjut lagi setelah dilepas
  ["pointerdown", "touchstart"].forEach(function (ev) {
    tr.addEventListener(ev, hold, { passive: true });
  });
  ["pointerup", "pointercancel", "touchend"].forEach(function (ev) {
    tr.addEventListener(ev, later, { passive: true });
  });
  tr.addEventListener(
    "wheel",
    function () {
      hold();
      later();
    },
    { passive: true },
  );
  tr.addEventListener("pointerenter", function (e) {
    if (e.pointerType == "mouse") hold();
  });
  tr.addEventListener("pointerleave", function (e) {
    if (e.pointerType == "mouse") later();
  });
  tr.addEventListener("keydown", function (e) {
    if (e.key == "ArrowLeft") {
      go(cur - 1);
      hold();
      later();
    }
    if (e.key == "ArrowRight") {
      go(cur + 1);
      hold();
      later();
    }
  });
  // hanya jalan saat slider terlihat di layar
  if ("IntersectionObserver" in window)
    new IntersectionObserver(
      function (en) {
        vis = en[0].isIntersecting;
      },
      { threshold: 0.4 },
    ).observe(tr);
  addEventListener("resize", function () {
    tr.scrollLeft = cur * tr.clientWidth;
  });

  mark();
  play();
})();
