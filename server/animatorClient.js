// ──────────────────────────────────────────────────
// Animator service client (Node → Python FastAPI)
//
// Sends the user's photo + driver video to the Python
// microservice and saves the returned mp4 to disk.
// ──────────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');
const http = require('http');

const ANIMATOR_URL = process.env.ANIMATOR_SERVICE_URL || 'http://localhost:8000';

/**
 * Call the Python animator service.
 *
 * @param {string} imagePath   – absolute path to the user's uploaded photo
 * @param {string} driverPath  – absolute path to the driver video mp4
 * @param {string} outputPath  – where to write the resulting mp4
 * @returns {Promise<string>}  – resolves with outputPath on success
 */
function callAnimator(imagePath, driverPath, outputPath) {
  return new Promise((resolve, reject) => {
    const boundary = '----SnapDanceBoundary' + Date.now().toString(36);

    // Build multipart body manually (no external dependency needed)
    const parts = [];

    // Part 1: source_image
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="source_image"; filename="${path.basename(imagePath)}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
    );
    const imageData = fs.readFileSync(imagePath);
    parts.push(imageData);
    parts.push('\r\n');

    // Part 2: driver_video
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="driver_video"; filename="${path.basename(driverPath)}"\r\n` +
      `Content-Type: video/mp4\r\n\r\n`
    );
    const driverData = fs.readFileSync(driverPath);
    parts.push(driverData);
    parts.push('\r\n');

    // Closing boundary
    parts.push(`--${boundary}--\r\n`);

    // Combine into a single Buffer
    const body = Buffer.concat(
      parts.map(p => (typeof p === 'string' ? Buffer.from(p, 'utf-8') : p))
    );

    const url = new URL(`${ANIMATOR_URL}/animate`);

    const options = {
      hostname: url.hostname,
      port:     url.port || 80,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Content-Length':  body.length,
      },
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', (chunk) => { errBody += chunk; });
        res.on('end', () => {
          reject(new Error(`Animator returned HTTP ${res.statusCode}: ${errBody}`));
        });
        return;
      }

      // Stream response body (mp4) directly to output file
      const file = fs.createWriteStream(outputPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
      file.on('error', (err) => {
        try { fs.unlinkSync(outputPath); } catch (_) {}
        reject(err);
      });
    });

    req.on('error', (err) => reject(err));

    // Set a generous timeout (model inference can take a while)
    req.setTimeout(300_000, () => {
      req.destroy(new Error('Animator request timed out (5 min)'));
    });

    req.end(body);
  });
}

module.exports = { callAnimator };
