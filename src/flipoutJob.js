import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import dayjs from 'dayjs';
import axios from 'axios';

import utc from 'dayjs/plugin/utc.js';
import isBetween from 'dayjs/plugin/isBetween.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(isBetween);
dayjs.extend(timezone);

// 🔐 USE ENV VARIABLES (IMPORTANT)
const s3 = new S3Client({
  region: 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = 'sl-voicebot-bucket';
const FOLDER_PATH = 'flipout-service-audio';
const API_ENDPOINT =
  'http://localhost:6001/s11e/v1/tenant/files/publish-flipout-data-call-analytics';

const runDailyDataJob = async () => {
  const now = dayjs();
  const twoMinutesAgo = now.subtract(2, 'minute');

  console.log(
    `[${now.format('YYYY-MM-DD HH:mm:ss')}] 🚀 Starting flipout Data S3 Job`
  );

  let continuationToken = undefined;
  const processedAudioFiles = [];

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: FOLDER_PATH,
      ContinuationToken: continuationToken,
    });

    const listedObjects = await s3.send(listCommand);

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) break;

    for (const file of listedObjects.Contents) {
      const { Key, LastModified } = file;

      if (!Key || !LastModified || Key.endsWith('/')) continue;

      const ext = path.extname(Key).toLowerCase();
      if (!['.mp3', '.wav'].includes(ext)) continue;

      if (
        LastModified >= twoMinutesAgo.toDate() &&
        LastModified <= now.toDate()
      ) {
        const audioUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: BUCKET_NAME, Key }),
          { expiresIn: 60 * 60 * 24 * 7 }
        );

        const jsonKey = Key.replace(/\.(mp3|wav)$/i, '') + '.json';

        let jsonUrl = '';
        try {
          await s3.send(
            new GetObjectCommand({ Bucket: BUCKET_NAME, Key: jsonKey })
          );

          jsonUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: BUCKET_NAME, Key: jsonKey }),
            { expiresIn: 60 * 60 * 24 * 7 }
          );
        } catch {
          console.warn(`⚠️ Metadata missing for ${Key}`);
        }

        const payload = {
          file_name: path.basename(Key),
          date: dayjs(LastModified).format('YYYY-MM-DD HH:mm:ss'),
          audio_download_link: audioUrl,
          metadata_download_link: jsonUrl,
        };

        processedAudioFiles.push(payload);

        try {
          const res = await axios.post(API_ENDPOINT, payload);
          console.log(
            `✅ API success | ${payload.file_name} | Status ${res.status}`
          );
        } catch (err) {
          console.error(
            `❌ API failed for ${payload.file_name}`,
            err.message
          );
        }
      }
    }

    continuationToken = listedObjects.IsTruncated
      ? listedObjects.NextContinuationToken
      : undefined;
  } while (continuationToken);

  console.log(
    processedAudioFiles.length
      ? `📦 Files processed: ${processedAudioFiles.length}`
      : '📭 No new audio files found'
  );
};

// ✅ RUN JOB
runDailyDataJob().catch(console.error);
