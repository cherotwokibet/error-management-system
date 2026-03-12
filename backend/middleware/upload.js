const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const THUMB_DIR  = path.join(UPLOAD_DIR, 'thumbnails');

// Ensure directories exist
[UPLOAD_DIR, THUMB_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WEBP)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
});

const generateThumbnail = async (filePath, filename) => {
  const thumbPath = path.join(THUMB_DIR, `thumb_${filename}`);
  try {
    await sharp(filePath)
      .resize(300, 200, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);
    return thumbPath;
  } catch (err) {
    console.error('Thumbnail generation failed:', err.message);
    return null;
  }
};

module.exports = { upload, generateThumbnail, UPLOAD_DIR, THUMB_DIR };
