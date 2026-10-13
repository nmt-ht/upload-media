// Đọc thông số âm thanh (tần số mẫu, độ sâu bit / bitrate) từ header file WAV / FLAC / MP3,
// không cần thư viện ngoài. Trả về chuỗi kiểu "48 kHz / 24-bit" hoặc '' nếu không đọc được.
const fs = require('fs');

function readHead(file, bytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

const khz = (hz) => `${+(hz / 1000).toFixed(2)} kHz`;

function wav(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  for (let p = 12; p + 8 <= buf.length;) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ' && p + 24 <= buf.length) {
      return `${khz(buf.readUInt32LE(p + 12))} / ${buf.readUInt16LE(p + 22)}-bit`;
    }
    p += 8 + size + (size % 2);
  }
  return null;
}

function flac(buf) {
  // "fLaC" + header khối STREAMINFO (4 byte); tần số 20 bit, độ sâu bit 5 bit (lưu giá trị - 1)
  if (buf.length < 26 || buf.toString('ascii', 0, 4) !== 'fLaC') return null;
  const s = 8;
  const rate = (buf[s + 10] << 12) | (buf[s + 11] << 4) | (buf[s + 12] >> 4);
  const bits = (((buf[s + 12] & 1) << 4) | (buf[s + 13] >> 4)) + 1;
  return `${khz(rate)} / ${bits}-bit`;
}

function mp3(buf) {
  let p = 0;
  if (buf.toString('ascii', 0, 3) === 'ID3' && buf.length > 10) {
    p = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  }
  const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  const BITRATE_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const BITRATE_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  for (; p + 4 <= buf.length; p++) {
    if (buf[p] !== 0xff || (buf[p + 1] & 0xe0) !== 0xe0) continue;
    const version = (buf[p + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layer = (buf[p + 1] >> 1) & 3;   // 1 = Layer III
    const bi = buf[p + 2] >> 4;
    const ri = (buf[p + 2] >> 2) & 3;
    if (version === 1 || layer !== 1 || bi === 0 || bi === 15 || ri === 3) continue;
    const kbps = (version === 3 ? BITRATE_V1_L3 : BITRATE_V2_L3)[bi];
    return `${khz(RATES[version][ri])} / ${kbps} kbps`;
  }
  return null;
}

module.exports = function audioInfo(file) {
  try {
    const buf = readHead(file, 256 * 1024);
    return wav(buf) || flac(buf) || mp3(buf) || '';
  } catch {
    return '';
  }
};
