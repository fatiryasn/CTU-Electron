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
  
  let browserClosed = false;
  let hasLoggedIn = false;
  const LOGIN_URL =
    "https://assurance.telkom.co.id/pro-man/index.php/login/index/";

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  //browser disconnect
  browser.on("disconnected", () => {
    browserClosed = true;
    log("⚠️ Browser ditutup oleh user. Program dihentikan.", "warning");
    doneCallback();
  });

  const page = await browser.newPage();


  // detect redirect
  page.on("framenavigated", async (frame) => {
    try {
      if (frame.url().startsWith(LOGIN_URL)) {
        if (hasLoggedIn) {
          log(
            "⚠️ Session habis atau redirect ke login. Program dihentikan. Ulangi prosedur dengan klik tombol GO",
            "warning"
          );
          if (!browserClosed) {
            browserClosed = true;
            await browser.close();
            doneCallback();
          }
        } else {
          log("🔐 Silakan login terlebih dahulu...", "info");
        }
      } else {
        hasLoggedIn = true;
      }
    } catch (e) {
      log(`❌ Error deteksi login redirect: ${e.message}`, "error");
    }
  });

  //dialogs handle
  page.on("dialog", async (dialog) => {
    const message = dialog.message();

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
    await page.goto(LOGIN_URL, {
      waitUntil: "networkidle2",
      timeout: 10000,
    });
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
    if (browserClosed) break;

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      await page.waitForSelector("#datatable > tbody > tr", { timeout: 0 });

      await page
        .waitForFunction(
          () => {
            const overlay = document.querySelector(".overlay");
            return !overlay || getComputedStyle(overlay).display === "none";
          },
          { timeout: 10000 }
        )
        .catch(() => {
          log("⚠️ Loader belum hilang sebelum sorting", "warning");
        });

      await page.evaluate(() => {
        const container = document.querySelector(
          "body > section > div.mainpanel > div > div:nth-child(4) > div > div > div"
        );
        if (container) container.scrollLeft = container.scrollWidth;
      });

      const sortHeader = await page.$(
        "#datatable > thead > tr > th:nth-child(14)"
      );
      if (sortHeader) {
        await sortHeader.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await sortHeader.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        log("⚠️ Kolom sorting_desc tidak ditemukan", "warning");
      }

      await page.evaluate(() => {
        const container = document.querySelector(
          "body > section > div.mainpanel > div > div:nth-child(4) > div > div > div"
        );
        if (container) container.scrollLeft = 0;
      });

      const rows = await page.$$("#datatable > tbody > tr");

      if (rowIndex >= rows.length) {
        log("✅ Semua data sudah diproses. Program selesai.", "success");
        browserClosed = true;
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

      await new Promise((resolve) => setTimeout(resolve, 1000));

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
