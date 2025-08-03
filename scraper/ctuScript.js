const puppeteer = require("puppeteer");

async function runAutomation(logCallback, dataCallback, doneCallback) {
  const log = (message, type = "info") => {
    const logObject = { message, type };
    console.log(`[${type.toUpperCase()}] ${message}`);
    if (logCallback) logCallback(logObject);
  };

  let currentInternetNum = null


  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();

  //dialogs handle
  page.on("dialog", async (dialog) => {
    const message = dialog.message();
    log(`📢 Dialog[${dialog.type()}]: ${message}`);

    //if success
    if (message.includes("Sukses Membuat Tiket") && message.includes("INC")) {
      const ticketMatch = message.match(/TicketID\] => (INC\d+)/);
      const ticketId = ticketMatch ? ticketMatch[1] : null;
      if (dataCallback && ticketId && currentInternetNum) {
        dataCallback({
          inet: currentInternetNum,
          ticket: ticketId,
          sto: "",
          odp: "",
          flag_hvc: "", 
        });
      }
    }

    await dialog.accept();

    if (
      message.includes("Sukses Membuat Tiket") ||
      message.includes("gagal create tiket")
    ) {
      log("----------------------------------------------", "");
    }
  });

  try {
    await page.goto(
      "https://assurance.telkom.co.id/pro-man/index.php/login/index/",
      {
        waitUntil: "networkidle2",
        timeout: 10000,
      }
    );
  } catch (error) {
    log(
      `\n❌ Gagal mengakses halaman. Kemungkinan penyebab:<br>- Tidak terhubung ke internet<br>- Situs hanya bisa diakses melalui VPN/internal network<br>- DNS gagal resolve (domain tidak dikenal)<br><br>Detail error:<br>${error.message}`, "error"
    );
    await browser.close()
    doneCallback()
    return;
  }

  log("🔐 Silakan login dan isi OTP di browser...");
  log("🧭 Setelah berhasil login, buka halaman: /dashboard/page/XXXX");
  log("⏳ Menunggu halaman target dibuka...");

  await page.waitForFunction(
    () => /\/dashboard\/page\/\d+$/.test(window.location.pathname),
    { polling: 1000, timeout: 0 }
  );

  log("🔎 URL cocok, tunggu elemen datatable...");
  await page.waitForSelector("#datatable > tbody > tr", { timeout: 0 });

  log("✅ Halaman target siap, mulai otomatisasi...\n");

  let rowIndex = 0;

  while (true) {
    try {
      const rows = await page.$$("#datatable > tbody > tr");

      if (rowIndex >= rows.length) {
        log("✅ Semua data sudah diproses. Otomatisasi selesai.", "success");
        doneCallback()
        break;
      }

      log(`Panjang baris: ${rows.length}`);
      const row = rows[rowIndex];
      const clickableLink = await row.$("td:nth-child(3) > a");

      if (!clickableLink) {
        log(`⏭️ Baris ${rowIndex + 1} tidak dapat diklik, lewati.`);
        log("----------------------------------------------");
        rowIndex++;
        continue;
      }

      currentInternetNum = await clickableLink.evaluate((el) =>
        el.textContent.trim()
      );

      log(
        `🖱️ Klik baris ${rowIndex + 1}... 📡 No Internet: ${
          currentInternetNum || "failed_to_read"
        }`
      );

      await clickableLink.click();
      log(`🛠️ Sedang membuat ticket...`);

      await page
        .waitForFunction(
          () => {
            const overlay = document.querySelector(".overlay");
            return overlay && getComputedStyle(overlay).display === "block";
          },
          { timeout: 10000 }
        )
        .catch(() => {
          log("⚠️ Loader tidak muncul, lanjut...", "warning");
          log("----------------------------------------------");
        });

      await page
        .waitForFunction(
          () => {
            const overlay = document.querySelector(".overlay");
            return overlay && getComputedStyle(overlay).display === "none";
          },
          { timeout: 10000 }
        )
        .catch(() => {});

      await page.waitForSelector("#datatable > tbody > tr");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      rowIndex = 0;
    } catch (err) {
      log(`❌ Terjadi error saat proses baris<br><br>Detail error:<br>${err.message}`, "error");
      log("----------------------------------------------");
      rowIndex++;
    }
  }

  // await browser.close(); // Uncomment kalau ingin ditutup otomatis
}

module.exports = runAutomation;
