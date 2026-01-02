import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const projectRoot = process.cwd();

// List of directories and files to exclude from the zip
const excludeList = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'out',
  'extension-build.zip',
];

/**
 * Recursively adds files from a directory to a zip archive.
 * @param directoryPath The path to the directory to add.
 * @param zip The JSZip instance.
 * @param root The root path to create relative paths from.
 */
async function addFilesToZip(directoryPath: string, zip: JSZip, root: string) {
  const files = await fs.promises.readdir(directoryPath);

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const relativePath = path.relative(root, filePath);

    if (excludeList.some(excluded => relativePath.startsWith(excluded))) {
      continue;
    }

    const stats = await fs.promises.stat(filePath);
    if (stats.isDirectory()) {
      await addFilesToZip(filePath, zip, root);
    } else {
      const content = await fs.promises.readFile(filePath);
      zip.file(relativePath, content);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    console.log('Starting project zip process...');
    const zip = new JSZip();

    // Add all files from the project root, respecting the exclude list
    await addFilesToZip(projectRoot, zip, projectRoot);

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9,
      },
    });

    console.log('Project zip created successfully.');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="reelview-project.zip"');
    res.status(200).send(zipBuffer);

  } catch (error: any) {
    console.error('Error creating project zip:', error);
    res.status(500).json({ success: false, message: 'Failed to create project zip.', error: error.message });
  }
}
