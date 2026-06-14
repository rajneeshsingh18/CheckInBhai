const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs/promises');
const { createId } = require('@paralleldrive/cuid2');

/**
 * 1. Multer Configuration
 * Configured for memory storage (files are kept in RAM as buffers)
 * so we can process them with Sharp before saving.
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only 1 file allowed per request
  },
  fileFilter
});

// Middleware to accept a single file named 'photo'
const uploadPhoto = upload.single('photo');

/**
 * Helper: Upload to Local Storage
 * (In production, replace this with AWS S3, Cloudflare R2, or Google Cloud Storage)
 */
async function uploadToStorage(buffer, societyId, dateStr, filename) {
  // Mock production S3 upload:
  /*
  const s3Params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `visitors/${societyId}/${dateStr}/${filename}`,
    Body: buffer,
    ContentType: 'image/webp'
  };
  await s3Client.send(new PutObjectCommand(s3Params));
  return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/visitors/${societyId}/${dateStr}/${filename}`;
  */

  // Local Development Upload:
  const uploadDir = path.join(__dirname, '../../uploads/visitors', societyId, dateStr);
  await fs.mkdir(uploadDir, { recursive: true });
  
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, buffer);
  
  // Return a local URL path accessible via express.static (assuming /uploads is hosted)
  return `/uploads/visitors/${societyId}/${dateStr}/${filename}`;
}

/**
 * 2. Process Visitor Photo Middleware
 * Compresses and standardizes the image using Sharp.
 */
const processVisitorPhoto = async (req, res, next) => {
  if (!req.file) {
    return next(); // Skip if no photo was uploaded
  }

  try {
    const societyId = req.user?.societyId || 'unknown_society';
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const uniqueFilename = `${createId()}.webp`;

    // Process image with Sharp
    const processedBuffer = await sharp(req.file.buffer)
      .resize(800, 800, {
        fit: 'inside', // Resize while maintaining aspect ratio, without cropping
        withoutEnlargement: true // Don't scale up smaller images
      })
      .webp({ quality: 80 }) // Convert to WebP with 80% quality
      .withMetadata(false) // Strip EXIF metadata (privacy/security)
      .toBuffer();

    // Upload to target storage
    const fileUrl = await uploadToStorage(processedBuffer, societyId, dateStr, uniqueFilename);

    // Attach the finalized URL to the request object so the controller can use it
    req.processedPhotoUrl = fileUrl;

    next();
  } catch (error) {
    console.error('Image Processing Error:', error);
    next(new Error('Failed to process image'));
  }
};

module.exports = {
  uploadPhoto,
  processVisitorPhoto
};
