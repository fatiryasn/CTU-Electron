const puppeteer = require("puppeteer");

async function runAutomation(logCallback, dataCallback, doneCallback) {
  const log = (message, type = "info") => {
    const logObject = { message, type };
    console.log(`[${type.toUpperCase()}] ${message}`);
    if (logCallback) logCallback(logObject);
  };

  let currentInternetNum = null;
  let sto = "",
    odp = "",
    flag_hvc = "";

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  //browser disconnect
  browser.on("disconnected", () => {
    log("⚠️ Browser ditutup oleh user. Program dihentikan.", "warning");
    doneCallback();
  });


  const page = await browser.newPage();

  //dialogs handle
  page.on("dialog", async (dialog) => {
    const message = dialog.message();

    if (/Session\s\d+\s*habis/i.test(message)) {
      log(
        "⚠️ Session habis, otomatis logout. Browser akan ditutup.",
        "warning"
      );
      await dialog.accept();
      await browser.close();
      doneCallback();
      return;
    }
    
    if (dialog.type() !== "confirm") {
      log(`📢 Dialog[${dialog.type()}]: ${message}`);
    }

    //if success
    if (message.includes("Sukses Membuat Tiket") && message.includes("INC")) {
      const ticketMatch = message.match(/TicketID\] => (INC\d+)/);
      const ticketId = ticketMatch ? ticketMatch[1] : null;
      if (dataCallback && ticketId && currentInternetNum) {
        dataCallback({
          inet: currentInternetNum,
          ticket: ticketId,
          sto,
          odp,
          flag_hvc,
        });
      }
    }

    await dialog.accept();
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
      `❌ Gagal mengakses halaman. Kemungkinan penyebab:<br>- Tidak terhubung ke internet<br>- Situs hanya bisa diakses melalui VPN/internal network<br>- DNS gagal resolve (domain tidak dikenal)<br><br>Detail error:<br>${error.message}`,
      "error"
    );
    await browser.close();
    doneCallback();
    return;
  }

  log(
    "🔐 Silakan login dan isi OTP di browser...<br>🧭 Setelah berhasil login, buka halaman Create Ticket Unspec<br>⏳ Menunggu halaman target dibuka..."
  );

  await page.waitForFunction(
    () => /\/dashboard\/page\/\d+$/.test(window.location.pathname),
    { polling: 1000, timeout: 0 }
  );

  log("🔎 URL cocok, tunggu elemen datatable...");
  await page.waitForSelector("#datatable > tbody > tr", { timeout: 0 });

  log("✅ Halaman target siap, mulai otomatisasi...");

  let rowIndex = 0;

  while (true) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const rows = await page.$$("#datatable > tbody > tr");

      if (rowIndex >= rows.length) {
        log("✅ Semua data sudah diproses. Otomatisasi selesai.", "success");
        doneCallback();
        break;
      }

      const row = rows[rowIndex];
      const clickableLink = await row.$("td:nth-child(3) > a");

      if (!clickableLink) {
        log(`⏭️ Baris ${rowIndex + 1} tidak dapat diklik, lewati.`);
        rowIndex++;
        continue;
      }

      currentInternetNum = await clickableLink.evaluate((el) =>
        el.textContent.trim()
      );
      sto = await row
        .$eval("td:nth-child(7)", (el) => el.textContent.trim())
        .catch(() => "");
      odp = await row
        .$eval("td:nth-child(8)", (el) => el.textContent.trim())
        .catch(() => "");
      flag_hvc = await row
        .$eval("td:nth-child(11)", (el) => el.textContent.trim())
        .catch(() => "");

      await page
        .waitForFunction(
          () => {
            const overlay = document.querySelector(".overlay");
            return !overlay || getComputedStyle(overlay).display === "none";
          },
          { timeout: 10000 }
        )
        .catch(() => {
          log("⚠️ Loader belum hilang dari proses sebelumnya", "warning");
        });

      await clickableLink.click();
      log(
        `🛠️ Klik baris ${rowIndex + 1}... 📡 No Internet: ${
          currentInternetNum || "failed_to_read"
        }`
      );

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

      rowIndex = 0;
    } catch (err) {
      log(
        `❌ Terjadi error saat proses baris<br><br>Detail error:<br>${err.message}`,
        "error"
      );
      rowIndex++;
    }
  }

  // await browser.close(); // Uncomment kalau ingin ditutup otomatis
}

module.exports = runAutomation;
