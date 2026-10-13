// Giới hạn upload — chỉnh tại đây nếu khách hàng đổi yêu cầu.
const KB = 1024;
const MB = 1024 * KB;

module.exports = {
  port: Number(process.env.PORT) || 3000,
  adminPassword: process.env.ADMIN_PASSWORD || 'changeme',

  image: {
    maxBytes: 360 * KB,
    width: 1920,
    height: 1080,
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  audio: {
    maxBytes: 300 * MB,
    minDuration: 10, // giây
    maxDuration: 15, // giây
    mimes: [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
      'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/flac', 'audio/x-flac', 'audio/webm',
    ],
  },
};
