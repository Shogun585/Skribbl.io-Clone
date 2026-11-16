export function floodFillCanvas(
  ctx: CanvasRenderingContext2D,
  normX: number,
  normY: number,
  fillHex: string
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const startX = Math.max(0, Math.min(width - 1, Math.floor(normX * width)));
  const startY = Math.max(0, Math.min(height - 1, Math.floor(normY * height)));

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const targetR = parseInt(fillHex.slice(1, 3), 16) || 0;
  const targetG = parseInt(fillHex.slice(3, 5), 16) || 0;
  const targetB = parseInt(fillHex.slice(5, 7), 16) || 0;

  const startIdx = (startY * width + startX) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];

  if (
    Math.abs(startR - targetR) < 8 &&
    Math.abs(startG - targetG) < 8 &&
    Math.abs(startB - targetB) < 8
  ) {
    return;
  }

  const matchesStart = (idx: number) =>
    Math.abs(data[idx] - startR) <= 24 &&
    Math.abs(data[idx + 1] - startG) <= 24 &&
    Math.abs(data[idx + 2] - startB) <= 24;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startX, startY];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    let currX = x;

    while (currX >= 0 && matchesStart((y * width + currX) * 4) && !visited[y * width + currX]) {
      currX--;
    }
    currX++;

    let spanAbove = false;
    let spanBelow = false;

    while (
      currX < width &&
      matchesStart((y * width + currX) * 4) &&
      !visited[y * width + currX]
    ) {
      const pIdx = (y * width + currX) * 4;
      data[pIdx] = targetR;
      data[pIdx + 1] = targetG;
      data[pIdx + 2] = targetB;
      data[pIdx + 3] = 255;
      visited[y * width + currX] = 1;

      if (y > 0) {
        const aboveMatches =
          matchesStart(((y - 1) * width + currX) * 4) && !visited[(y - 1) * width + currX];
        if (!spanAbove && aboveMatches) {
          stack.push(currX, y - 1);
          spanAbove = true;
        } else if (spanAbove && !aboveMatches) {
          spanAbove = false;
        }
      }

      if (y < height - 1) {
        const belowMatches =
          matchesStart(((y + 1) * width + currX) * 4) && !visited[(y + 1) * width + currX];
        if (!spanBelow && belowMatches) {
          stack.push(currX, y + 1);
          spanBelow = true;
        } else if (spanBelow && !belowMatches) {
          spanBelow = false;
        }
      }
      currX++;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
