const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const issueMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    return {
      folder: 'civicpulse/issue-media',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo ? ['mp4', 'mov', 'avi', 'webm'] : ['jpg', 'jpeg', 'png', 'webp'],
      transformation: isVideo ? [] : [{ width: 1920, height: 1080, crop: 'limit', quality: 'auto' }]
    };
  }
});

const issueUpload = multer({
  storage: issueMediaStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 3
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPG, PNG, WebP) and videos (MP4, MOV, AVI, WebM) are allowed'));
    }
  }
});

// Memory storage for temporary processing
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = { issueUpload, memoryUpload };
