import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { uploadBufferToBackblaze } from '../services/backblaze';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 128 * 1024 * 1024,
  },
});

router.post('/upload-asset', authenticate, upload.single('mediaFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'No file uploaded' },
      });
    }

    const isVideo = req.file.mimetype.startsWith('video/');
    const uploadResult = await uploadBufferToBackblaze(req.file.buffer, req.file.originalname, {
      bucketTypes: isVideo ? ['videos', 'general'] : ['general', 'videos'],
      prefix: isVideo ? 'compose/videos' : 'compose/images',
      contentType: req.file.mimetype,
    });

    res.status(201).json({
      success: true,
      data: {
        url: uploadResult.url,
        fileName: uploadResult.fileName,
        fileId: uploadResult.fileName,
        originalName: req.file.originalname,
        contentType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error('Error uploading compose asset:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to upload asset' },
    });
  }
});

export default router;
