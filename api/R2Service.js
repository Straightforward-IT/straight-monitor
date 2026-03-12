const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('./utils/logger'); // Assuming this exists based on instructions

class R2Service {
  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || 'monitor-bucket';
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      // Cloudflare R2 docs recommend applying pathstyle URL config? actually virtual host works fine.
    });
  }

  /**
   * Upload a buffer to R2.
   * @param {string} key - The destination path/filename.
   * @param {Buffer|Uint8Array|string} fileBuffer - The file content.
   * @param {string} contentType - The MIME type.
   * @returns {Promise<Object>} Information about the upload.
   */
  async uploadFile(key, fileBuffer, contentType = 'application/octet-stream') {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      const response = await this.client.send(command);
      logger.info(`Successfully uploaded file ${key} to R2 bucket ${this.bucketName}`);
      return response;
    } catch (error) {
      logger.error(`Error uploading file ${key} to R2:`, error);
      throw error;
    }
  }

  /**
   * Generate a pre-signed URL to download or view a file.
   * @param {string} key - The path/filename in R2.
   * @param {number} expiresInSeconds - How long the URL is valid. Default 3600 (1h).
   * @returns {Promise<string>} The pre-signed URL.
   */
  async getSignedDownloadUrl(key, expiresInSeconds = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      // Generate the presigned URL
      const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
      return url;
    } catch (error) {
      logger.error(`Error generating signed URL for ${key} from R2:`, error);
      throw error;
    }
  }

  /**
   * Download a file from R2 directly into memory.
   * @param {string} key - The path/filename in R2.
   * @returns {Promise<Buffer>} The file content as a Buffer.
   */
  async downloadFile(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.client.send(command);
      
      // stream to buffer
      const streamToBuffer = async (stream) => {
        return new Promise((resolve, reject) => {
          const chunks = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
      };
      
      return await streamToBuffer(response.Body);
    } catch (error) {
      logger.error(`Error downloading file ${key} from R2:`, error);
      throw error;
    }
  }

  /**
   * Delete a file from R2.
   * @param {string} key - The path/filename to delete.
   * @returns {Promise<Object>} Response from deletion.
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.client.send(command);
      logger.info(`Successfully deleted file ${key} from R2`);
      return response;
    } catch (error) {
      logger.error(`Error deleting file ${key} from R2:`, error);
      throw error;
    }
  }
}

// Export as an instantiated singleton
module.exports = new R2Service();
