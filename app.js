      // ===== JavaScript: Network Info Retrieval and Real-Time Updates =====

      // Elements from the DOM that we will update
      const elPublicIpv4 = document.getElementById("publicIpv4");
      const elPublicIpv6 = document.getElementById("publicIpv6");
      const elPrivateIp = document.getElementById("privateIp");
      const elISP = document.getElementById("isp");
      const elASN = document.getElementById("asn");
      const elLocation = document.getElementById("location");
      const elConnType = document.getElementById("connType");
      const elEffectiveType = document.getElementById("effectiveType");
      const elIpVersion = document.getElementById("ipVersion");
      const elDnsInfo = document.getElementById("dnsInfo");
      const elPing = document.getElementById("ping");
      const elDownload = document.getElementById("downloadSpeed");
      const elUpload = document.getElementById("uploadSpeed");
      const elWebRTCLeak = document.getElementById("webrtcLeak");
      const elVPNDetect = document.getElementById("vpnDetect");
      const historyList = document.getElementById("historyList");
      const speedTestBtn = document.getElementById("speedTestBtn");

      // Local storage key for history
      const HISTORY_KEY = "networkHistory";

      // Function to update the network history list in the UI
      function updateHistoryUI() {
        const historyData = JSON.parse(
          localStorage.getItem(HISTORY_KEY) || "[]"
        );
        historyList.innerHTML = "";
        historyData.forEach((record) => {
          const li = document.createElement("li");
          li.textContent = `${new Date(
            record.timestamp
          ).toLocaleTimeString()} – IP: ${record.ip}, Type: ${
            record.networkType
          }`;
          historyList.appendChild(li);
        });
      }

      // Save a new record to local history (and trim old records to keep it concise)
      function saveHistoryRecord(ip, networkType) {
        let historyData = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        // Only add if the last record is different (to avoid duplicates when nothing changed)
        const lastRecord = historyData[historyData.length - 1];
        if (
          !lastRecord ||
          lastRecord.ip !== ip ||
          lastRecord.networkType !== networkType
        ) {
          const newRecord = {
            timestamp: Date.now(),
            ip: ip,
            networkType: networkType,
          };
          historyData.push(newRecord);
          // Keep only the last 5 records to avoid unlimited growth
          if (historyData.length > 5) {
            historyData = historyData.slice(-5);
          }
          localStorage.setItem(HISTORY_KEY, JSON.stringify(historyData));
          updateHistoryUI();
        }
      }

      // ===== Get Public IP and Network info from external API =====
      // We use a public IP geolocation API (ipwho.is) to get public IP, ISP, ASN, and geolocation&#8203;:contentReference[oaicite:0]{index=0}.
      // This API is free for client-side use (no API key needed) and returns JSON data.
      function fetchPublicNetworkInfo() {
        // The API will return data for the current user's IP if no IP is specified in the URL
        const apiURL =
          "https://ipwho.is/?fields=ip,success,type,connection,isp,asn,city,region,country,latitude,longitude";
        fetch(apiURL)
          .then((response) => response.json())
          .then((data) => {
            if (!data.success) {
              console.error("IP API request failed:", data);
              return;
            }
            const publicIP = data.ip || ""; // Public IP (could be IPv4 or IPv6)
            const ipType = data.type || ""; // "IPv4" or "IPv6"
            const ispName =
              data.connection?.isp ||
              data.connection?.org ||
              data.connection?.organization ||
              data.isp ||
              "Unknown ISP";
            const asNumber = data.connection?.asn || data.asn || ""; // Autonomous System Number
            const city = data.city || "";
            const region = data.region || data.region_code || "";
            const country = data.country || data.country_code || "";
            const latitude = data.latitude || "";
            const longitude = data.longitude || "";

            // Update the DOM elements with fetched data
            if (ipType === "IPv6") {
              // If the public IP is IPv6, display it under IPv6 field and leave IPv4 field empty (or vice versa)
              elPublicIpv6.textContent = publicIP;
              elPublicIpv4.textContent = "N/A";
            } else {
              elPublicIpv4.textContent = publicIP;
              elPublicIpv6.textContent = "N/A";
            }
            elISP.textContent = ispName;
            elASN.textContent = asNumber ? `AS${asNumber}` : "N/A";
            elLocation.textContent =
              city && country ? `${city}, ${country}` : country || "N/A";

            // Determine IPv4 vs IPv6 connectivity
            elIpVersion.textContent = ipType ? ipType : "Unknown";

            // Basic VPN/Proxy detection: if ISP/Org looks like a data center or proxy service
            // (This is a simplistic check; a dedicated API or the security fields of ipwho.is could be used for more accuracy)
            let vpnDetected = false;
            const ispLower = ispName.toLowerCase();
            const dataCenterKeywords = [
              "vpn",
              "proxy",
              "hosting",
              "host",
              "cloud",
              "amazon",
              "google",
              "digitalocean",
              "ovh",
              "microsoft",
              "azure",
            ];
            dataCenterKeywords.forEach((keyword) => {
              if (ispLower.includes(keyword)) vpnDetected = true;
            });
            elVPNDetect.textContent = vpnDetected
              ? "Yes (Potential VPN/Proxy)"
              : "No";

            // Save this info in history (using public IP as key identifier and network type)
            const netTypeLabel =
              navigator.connection && navigator.connection.effectiveType
                ? navigator.connection.effectiveType
                : ipType || "Unknown";
            saveHistoryRecord(publicIP, netTypeLabel);
          })
          .catch((err) => {
            console.error("Error fetching IP info:", err);
          });
      }

      // ===== Detect Private IPs via WebRTC (to check for WebRTC IP leaks) =====
      // This function uses WebRTC RTCPeerConnection to find local IP addresses (private network IP) accessible by the browser&#8203;:contentReference[oaicite:1]{index=1}.
      function detectLocalIPs() {
        return new Promise((resolve) => {
          const ipsFound = [];
          // Use a STUN server to gather ICE candidates. Google's public STUN server is used.
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          // Create a bogus data channel to trigger ICE candidate gathering
          pc.createDataChannel("");
          // Listen for ICE candidates
          pc.onicecandidate = (event) => {
            if (event.candidate && event.candidate.candidate) {
              const candidate = event.candidate.candidate;
              // Regex to extract the IP address from the candidate string (covers IPv4 and IPv6)&#8203;:contentReference[oaicite:2]{index=2}
              const ipRegex =
                /([0-9]{1,3}(?:\.[0-9]{1,3}){3})|([0-9a-fA-F:]{4,})/;
              const match = candidate.match(ipRegex);
              if (match) {
                const ip = match[0];
                if (!ipsFound.includes(ip)) {
                  ipsFound.push(ip);
                }
              }
            } else {
              // No more candidates (event.candidate is null), done gathering.
              pc.close();
              resolve(ipsFound);
            }
          };
          // Start the ICE gathering process by creating an offer
          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .catch((err) => {
              console.warn("WebRTC offer failed", err);
              resolve(ipsFound);
            });
          // In case onicecandidate doesn't resolve (some browser restrictions), set a timeout as fallback
          setTimeout(() => {
            if (ipsFound.length === 0) {
              try {
                pc.close();
              } catch (e) {}
              resolve(ipsFound);
            }
          }, 1000);
        });
      }

      // ===== Get Network Connection Type and Speed Estimates (Navigator API) =====
      // The Network Information API provides info on connection type (e.g., 'wifi', 'cellular') and estimated speed&#8203;:contentReference[oaicite:3]{index=3}.
      function updateConnectionInfo() {
        const connection =
          navigator.connection ||
          navigator.mozConnection ||
          navigator.webkitConnection ||
          null;
        if (connection) {
          // Network type (e.g., wifi, cellular) and effective type (e.g., 4g, 3g)
          elConnType.textContent = connection.type || "Unknown";
          elEffectiveType.textContent = connection.effectiveType || "Unknown";
        } else {
          // Not supported in this browser
          elConnType.textContent = "Unavailable";
          elEffectiveType.textContent = "Unavailable";
        }
      }

      // ===== Measure Ping (latency) =====
      function measurePing(callback) {
        // We ping a small resource (a tiny image) to measure round-trip time.
        const pingImg = new Image();
        const start = performance.now();
        pingImg.onload = pingImg.onerror = function () {
          const end = performance.now();
          const pingTime = Math.round(end - start);
          callback(pingTime);
        };
        // Use a cache-busting query param to avoid cached response
        pingImg.src =
          "https://www.google.com/favicon.ico?cache=" + Math.random();
      }

      // ===== Measure Download Speed =====
      function measureDownloadSpeed(callback) {
        // Download a file of known size and measure the time taken.
        const image = new Image();
        const imageUrl =
          "https://upload.wikimedia.org/wikipedia/commons/5/5a/Big5-test.png";
        // ^ Example image (~1.4 MB) from Wikipedia (which allows cross-origin access).
        const downloadSizeBytes = 1464218; // size of the above image in bytes (approx 1.4 MB)
        const startTime = performance.now();
        image.onload = function () {
          const endTime = performance.now();
          const durationSeconds = (endTime - startTime) / 1000;
          const bitsLoaded = downloadSizeBytes * 8;
          const speedBps = bitsLoaded / durationSeconds;
          const speedMbps = (speedBps / (1024 * 1024)).toFixed(2); // convert to Mbps
          callback(speedMbps);
        };
        image.onerror = function () {
          console.warn("Download test error (image failed to load).");
          callback(null);
        };
        // Start download with cache busting
        image.src = imageUrl + "?cache=" + Math.random();
      }

      // ===== Measure Upload Speed =====
      function measureUploadSpeed(callback) {
        // To measure upload, we send a POST request with a known payload to a public echo server.
        // Here we use httpbin.org which will reflect the data back (and allows CORS for testing).
        const dataSize = 2 * 1024 * 1024; // 2 MB of data
        const testData = new Uint8Array(dataSize);
        // Fill the array with some data
        for (let i = 0; i < dataSize; i++) {
          testData[i] = 0;
        }
        const startTime = performance.now();
        fetch("https://httpbin.org/post", {
          method: "POST",
          body: testData,
        })
          .then((res) => {
            const endTime = performance.now();
            const durationSeconds = (endTime - startTime) / 1000;
            const bitsSent = dataSize * 8;
            const speedBps = bitsSent / durationSeconds;
            const speedMbps = (speedBps / (1024 * 1024)).toFixed(2);
            callback(speedMbps);
          })
          .catch((err) => {
            console.warn("Upload test failed:", err);
            callback(null);
          });
      }

      // ===== Function to run full speed test (ping, download, upload) =====
      function runSpeedTest() {
        // Ping
        measurePing((time) => {
          elPing.textContent = time + " ms";
        });
        // Download
        measureDownloadSpeed((mbps) => {
          elDownload.textContent = mbps ? mbps + " Mbps" : "Error";
        });
        // Upload
        measureUploadSpeed((mbps) => {
          elUpload.textContent = mbps ? mbps + " Mbps" : "Error";
        });
      }

      // Attach event listener to the "Test Speed Now" button for manual re-tests
      speedTestBtn.addEventListener("click", runSpeedTest);

      // ===== Initialize: Fetch data and set up periodic updates =====
      detectLocalIPs().then((localIPs) => {
        // Display the first private IP found (if any). Usually, the first one is the primary local IP.
        if (localIPs.length > 0) {
          elPrivateIp.textContent = localIPs.join(", ");
          elWebRTCLeak.textContent = localIPs.some(
            (ip) =>
              ip.startsWith("192.") ||
              ip.startsWith("10.") ||
              ip.startsWith("172.")
          )
            ? "Private IP Exposed"
            : "No private IP detected";
        } else {
          elPrivateIp.textContent = "N/A";
          elWebRTCLeak.textContent = "No private IP detected";
        }
      });

      // Fetch initial public network info and update connection info
      fetchPublicNetworkInfo();
      updateConnectionInfo();
      runSpeedTest(); // perform initial speed test on page load

      // Update the history UI (in case there's existing data from previous visits)
      updateHistoryUI();

      // Set up live updates: refresh network info every few seconds
      setInterval(() => {
        fetchPublicNetworkInfo(); // refresh public IP, ISP, etc.
        updateConnectionInfo(); // refresh connection type (if changed)
        measurePing((time) => {
          // continuously update ping
          elPing.textContent = time + " ms";
        });
        // Note: We do not run full download/upload test on every interval due to performance.
        // Those can be triggered manually or at longer intervals if desired.
      }, 10000); // every 10 seconds (adjust as needed for "real-time")