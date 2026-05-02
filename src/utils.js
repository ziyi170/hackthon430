export async function copyFile(pod, sourcePath, destinationPath) {
  const f = await pod.createFile(destinationPath, "binary");
  const resp = await fetch(sourcePath);
  const buf = await resp.arrayBuffer();
  await f.write(buf);
  await f.close();
}
