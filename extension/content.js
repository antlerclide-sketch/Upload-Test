// TikTok Quality Tool - Button-based bypass (no automatic interception)

(function() {
  const PADDING_NAL = new Uint8Array([0,0,0,4,0,0,0,0]);
  const PADDING_SIZE = 8;
  const KEEP_NALU_TYPES = new Set([1,5,7,8]);
  const LANG_UND = 0x55c4;
  const MIN_DECLARED = 2000;
  const COMMENT = 'TK8vY5VqBA6hUlo1yuGvNA';

  function readU32(dv, off) { return dv.getUint32(off, false); }
  function findBox(data, type, start, end) {
    const dv = new DataView(data);
    let i = start || 0;
    const ed = end || data.byteLength;
    while (i + 8 <= ed) {
      const size = readU32(dv, i);
      if (size < 8) break;
      let t = '';
      for (let j = 0; j < 4; j++) t += String.fromCharCode(dv.getUint8(i+4+j));
      const actualSize = size === 0 ? ed - i : size;
      if (t === type) return { start: i, end: i + actualSize, size: actualSize };
      i += actualSize;
    }
    return null;
  }
  function findBoxPath(data, types, start, end) {
    let s = start, e = end;
    for (const t of types) {
      const box = findBox(data, t, s, e);
      if (!box) return null;
      s = box.start + 8; e = box.end;
    }
    return { start: s, end: e };
  }
  function findTrakByHandler(data, moovStart, moovEnd, handlerType) {
    let i = moovStart + 8;
    while (i + 8 <= moovEnd) {
      const dv = new DataView(data);
      const size = readU32(dv, i);
      if (size < 8) break;
      let t = '';
      for (let j = 0; j < 4; j++) t += String.fromCharCode(dv.getUint8(i+4+j));
      if (t === 'trak') {
        const trakEnd = i + (size === 0 ? moovEnd - i : size);
        const mdia = findBoxPath(data, ['mdia', 'hdlr'], i + 8, trakEnd);
        if (mdia) {
          const hdlrData = new DataView(data, mdia.start, mdia.end - mdia.start);
          const hType = String.fromCharCode(hdlrData.getUint8(8), hdlrData.getUint8(9), hdlrData.getUint8(10), hdlrData.getUint8(11));
          if (hType === handlerType) return { start: i, end: trakEnd, size: trakEnd - i };
        }
      }
      i += size === 0 ? moovEnd - i : size;
    }
    return null;
  }
  function parseNaluList(sample) {
    const nalus = [];
    let i = 0;
    while (i + 4 <= sample.length) {
      const len = readU32(new DataView(sample.buffer, sample.byteOffset + i, 4), 0);
      if (len === 0 || i + 4 + len > sample.length) break;
      const type = sample[i+4] & 0x1f;
      nalus.push({ type, data: sample.slice(i+4, i+4+len), totalLen: 4 + len });
      i += 4 + len;
    }
    return nalus;
  }
  function buildBox(type, content) {
    const typeB = new Uint8Array([...type.split('').map(c => c.charCodeAt(0))]);
    const size = 8 + content.byteLength;
    const buf = new ArrayBuffer(size);
    const dv = new DataView(buf);
    dv.setUint32(0, size, false);
    for (let i = 0; i < 4; i++) dv.setUint8(4+i, typeB[i]);
    new Uint8Array(buf, 8).set(new Uint8Array(content));
    return buf;
  }
  function buildFtyp() {
    return buildBox('ftyp', new Uint8Array([0x69,0x73,0x6f,0x6d, 0,0,2,0, 0x69,0x73,0x6f,0x6d,0x69,0x73,0x6f,0x32,0x61,0x76,0x63,0x31,0x6d,0x70,0x34,0x31]));
  }
  function buildFree() { return new Uint8Array([0,0,0,8, 0x66,0x72,0x65,0x65]).buffer; }
  function buildStts(entries) {
    const bodySize = 8 + entries.length * 8;
    const buf = new ArrayBuffer(8 + bodySize);
    const dv = new DataView(buf);
    dv.setUint32(0, 8 + bodySize, false); dv.setUint32(4, 0x73747473, false);
    dv.setUint32(8, 0, false); dv.setUint32(12, entries.length, false);
    for (let i = 0; i < entries.length; i++) { dv.setUint32(16 + i*8, entries[i][0], false); dv.setUint32(20 + i*8, entries[i][1], false); }
    return buf;
  }
  function buildStsz(sizes) {
    const bodySize = 12 + sizes.length * 4;
    const buf = new ArrayBuffer(8 + bodySize);
    const dv = new DataView(buf);
    dv.setUint32(0, 8 + bodySize, false); dv.setUint32(4, 0x7374737a, false);
    dv.setUint32(8, 0, false); dv.setUint32(12, 0, false); dv.setUint32(16, sizes.length, false);
    for (let i = 0; i < sizes.length; i++) dv.setUint32(20 + i*4, sizes[i], false);
    return buf;
  }
  function buildStsc(entries) {
    const bodySize = 8 + entries.length * 12;
    const buf = new ArrayBuffer(8 + bodySize);
    const dv = new DataView(buf);
    dv.setUint32(0, 8 + bodySize, false); dv.setUint32(4, 0x73747363, false);
    dv.setUint32(8, 0, false); dv.setUint32(12, entries.length, false);
    for (let i = 0; i < entries.length; i++) {
      dv.setUint32(16 + i*12, entries[i][0], false); dv.setUint32(20 + i*12, entries[i][1], false); dv.setUint32(24 + i*12, entries[i][2], false);
    }
    return buf;
  }
  function buildStco(offsets) {
    const bodySize = 8 + offsets.length * 4;
    const buf = new ArrayBuffer(8 + bodySize);
    const dv = new DataView(buf);
    dv.setUint32(0, 8 + bodySize, false); dv.setUint32(4, 0x7374636f, false);
    dv.setUint32(8, 0, false); dv.setUint32(12, offsets.length, false);
    for (let i = 0; i < offsets.length; i++) dv.setUint32(16 + i*4, offsets[i], false);
    return buf;
  }
  function buildMvhd(origContent, durationMs) {
    const content = new Uint8Array(origContent);
    const dv = new DataView(content.buffer, content.byteOffset, content.byteLength);
    dv.setUint32(16, durationMs, false);
    return buildBox('mvhd', content);
  }
  function buildMdhd(origContent, duration, language) {
    const content = new Uint8Array(origContent);
    const dv = new DataView(content.buffer, content.byteOffset, content.byteLength);
    if (duration !== undefined) dv.setUint32(16, duration, false);
    if (language !== undefined) dv.setUint16(20, language, false);
    return buildBox('mdhd', content);
  }
  function buildTkhd(tkhdData, durationMs) {
    const buf = new Uint8Array(tkhdData);
    if (durationMs !== undefined) { const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); dv.setUint32(28, durationMs, false); }
    return buf.buffer;
  }
  function buildHdlr(type, name) {
    const nameB = new TextEncoder().encode(name + '\0');
    return buildBox('hdlr', new Uint8Array([0,0,0,0, 0,0,0,0, ...type.split('').map(c=>c.charCodeAt(0)), 0,0,0,0,0,0,0,0,0,0,0,0, ...nameB]));
  }
  function buildAvcc(origContent) {
    return buildBox('avcC', new Uint8Array(origContent));
  }
  function buildBtrt(bufSize, maxBr, avgBr) {
    const body = new ArrayBuffer(12);
    const dv = new DataView(body);
    dv.setUint32(0, bufSize, false); dv.setUint32(4, maxBr, false); dv.setUint32(8, avgBr, false);
    return buildBox('btrt', body);
  }
  function buildUdtaComment(comment) {
    const metaHdlr = buildBox('hdlr', new Uint8Array([0,0,0,0, 0,0,0,0, 0x6d,0x64,0x69,0x72, 0x61,0x70,0x70,0x6c, 0,0,0,0,0,0,0,0, 0]));
    const enc = new TextEncoder().encode(comment);
    const dataBody = new Uint8Array([0,0,0,1, 0,0,0,0, ...enc]);
    const dataBox = buildBox('data', dataBody);
    const cmtBody = new Uint8Array(8 + dataBox.byteLength);
    new DataView(cmtBody.buffer).setUint32(0, 8 + dataBox.byteLength, false);
    cmtBody[4] = 0xa9; cmtBody[5] = 0x63; cmtBody[6] = 0x6d; cmtBody[7] = 0x74;
    cmtBody.set(new Uint8Array(dataBox), 8);
    const ilst = buildBox('ilst', cmtBody);
    const metaContent = new Uint8Array([0,0,0,0, ...new Uint8Array(metaHdlr), ...new Uint8Array(ilst)]);
    return buildBox('udta', buildBox('meta', metaContent));
  }
  function concatArrayBuffers(buffers) {
    let total = 0;
    for (const b of buffers) total += b.byteLength;
    const result = new Uint8Array(total);
    let offset = 0;
    for (const b of buffers) { result.set(new Uint8Array(b), offset); offset += b.byteLength; }
    return result.buffer;
  }

  function transform(inputBuffer, minDeclared) {
    const data = inputBuffer;
    const dv = new DataView(data);
    const moov = findBox(data, 'moov');
    const mdat = findBox(data, 'mdat');
    if (!moov || !mdat) throw new Error('Missing moov or mdat');
    const mdatDataStart = mdat.start + 8;
    const vt = findTrakByHandler(data, moov.start, moov.end, 'vide');
    if (!vt) throw new Error('No video track');
    const stbl = findBoxPath(data, ['mdia', 'minf', 'stbl'], vt.start + 8, vt.end);
    if (!stbl) throw new Error('No stbl');
    const sb = stbl.start, se = stbl.end;
    const stco = findBox(data, 'stco', sb, se);
    const stsz = findBox(data, 'stsz', sb, se);
    const stsc = findBox(data, 'stsc', sb, se);
    const stts = findBox(data, 'stts', sb, se);
    const stsd = findBox(data, 'stsd', sb, se);
    const stss = findBox(data, 'stss', sb, se);
    const sdtp = findBox(data, 'sdtp', sb, se);
    const ctts = findBox(data, 'ctts', sb, se);
    if (!stco || !stsz || !stsc || !stts || !stsd) throw new Error('Missing stbl atoms');
    const chunkOffsets = [];
    const chunkCount = readU32(dv, stco.start + 12);
    for (let i = 0; i < chunkCount; i++) chunkOffsets.push(readU32(dv, stco.start + 16 + i*4));
    const stszUniform = readU32(dv, stsz.start + 12);
    const stszCount = readU32(dv, stsz.start + 16);
    let sampleSizes;
    if (stszUniform === 0) {
      sampleSizes = [];
      for (let i = 0; i < stszCount; i++) sampleSizes.push(readU32(dv, stsz.start + 20 + i*4));
    } else { sampleSizes = new Array(stszCount).fill(stszUniform); }
    const stscEntries = [];
    const stscCount = readU32(dv, stsc.start + 12);
    for (let i = 0; i < stscCount; i++) stscEntries.push([readU32(dv, stsc.start + 16 + i*12), readU32(dv, stsc.start + 20 + i*12), readU32(dv, stsc.start + 24 + i*12)]);
    const sttsEntryCount = readU32(dv, stts.start + 12);
    const sttsEntries = [];
    for (let i = 0; i < sttsEntryCount; i++) sttsEntries.push([readU32(dv, stts.start + 16 + i*8), readU32(dv, stts.start + 20 + i*8)]);
    const timeDelta = sttsEntries[0][1];
    const origFrames = sampleSizes.length;
    const padCount = Math.max(0, minDeclared - origFrames);
    const vMdhd = findBoxPath(data, ['mdia', 'mdhd'], vt.start + 8, vt.end);
    if (!vMdhd) throw new Error('No video mdhd');
    const vTimescale = readU32(dv, vMdhd.start + 12);
    const vDuration = readU32(dv, vMdhd.start + 16);
    const vDurationSec = vDuration / vTimescale;
    const firstOff = chunkOffsets[0];
    const firstSize = sampleSizes[0];
    const firstSample = new Uint8Array(data, firstOff, firstSize);
    const newFirstSize = firstSize;
    const seiRemoved = 0;
    const at = findTrakByHandler(data, moov.start, moov.end, 'soun');
    let hasAudio = !!at, audioChunks = [], audioSizes = [], newAStts = null, newAudioDurMs = 0;
    let aTimescale = 0, oldABr = 0, newABr = 0;
    let audioStsdArr = null, audioSttsNewArr = null, audioStsc = null, audioStsz = null, aSgpd = null, aSbgp = null;
    let audioSmhd = null, audioDinf = null, audioMdhd = null, audioHdlr = null, audioTkhd = null, audioEdts = null;
    if (hasAudio) {
      const aStbl = findBoxPath(data, ['mdia', 'minf', 'stbl'], at.start + 8, at.end);
      if (!aStbl) throw new Error('Missing audio stbl');
      const aStco = findBox(data, 'stco', aStbl.start, aStbl.end);
      const aStsz = findBox(data, 'stsz', aStbl.start, aStbl.end);
      const aStts = findBox(data, 'stts', aStbl.start, aStbl.end);
      const aMdhd = findBoxPath(data, ['mdia', 'mdhd'], at.start + 8, at.end);
      if (!aMdhd) throw new Error('Missing audio mdhd');
      aTimescale = readU32(dv, aMdhd.start + 12);
      const aElst = findBoxPath(data, ['edts', 'elst'], at.start + 8, at.end);
      if (!aElst) throw new Error('Missing audio elst');
      const aElstSegDur = readU32(dv, aElst.start + 16);
      const aElstMediaTime = readU32(dv, aElst.start + 20);
      newAudioDurMs = aElstSegDur;
      const newAudioDur = newAudioDurMs * aTimescale / 1000;
      if (!aStco) throw new Error('Missing audio stco');
      if (!aStsz) throw new Error('Missing audio stsz');
      if (!aStts) throw new Error('Missing audio stts');
      const aChunkCount = readU32(dv, aStco.start + 12);
      for (let i = 0; i < aChunkCount; i++) audioChunks.push(readU32(dv, aStco.start + 16 + i*4));
      const aStszUniform = readU32(dv, aStsz.start + 12);
      const aStszCount = readU32(dv, aStsz.start + 16);
      if (aStszUniform === 0) { for (let i = 0; i < aStszCount; i++) audioSizes.push(readU32(dv, aStsz.start + 20 + i*4)); }
      else { audioSizes = new Array(aStszCount).fill(aStszUniform); }
      const aSttsCount = readU32(dv, aStts.start + 12);
      const aSttsEntries = [];
      for (let i = 0; i < aSttsCount; i++) aSttsEntries.push([readU32(dv, aStts.start + 16 + i*8), readU32(dv, aStts.start + 20 + i*8)]);
      const aDelta = aSttsEntries[0][1];
      const aCount = audioSizes.length;
      const targetStts = newAudioDur + aElstMediaTime;
      const mainN = aCount - 1;
      const lastDelta = targetStts - mainN * aDelta;
      if (lastDelta > 0 && lastDelta <= aDelta) { newAStts = [[mainN, aDelta], [1, lastDelta]]; }
      else { newAStts = aSttsEntries; }
      const totalABytes = audioSizes.reduce((s, v) => s + v, 0);
      const oldATicks = aSttsEntries.reduce((s, [c, d]) => s + c * d, 0);
      const newATicks = newAStts.reduce((s, [c, d]) => s + c * d, 0);
      if (!oldATicks || !newATicks) throw new Error('Audio ticks zero');
      oldABr = Math.floor(totalABytes * 8 * aTimescale / oldATicks);
      newABr = Math.floor(totalABytes * 8 * aTimescale / newATicks);
    }
    const mdatBefore = new Uint8Array(data, mdatDataStart, firstOff - mdatDataStart);
    const mdatAfter = new Uint8Array(data, firstOff + firstSize, mdat.start + mdat.size - (firstOff + firstSize));
    const newMdatContent = new Uint8Array(mdatBefore.length + firstSize + mdatAfter.length + PADDING_SIZE);
    newMdatContent.set(mdatBefore, 0);
    newMdatContent.set(firstSample, mdatBefore.length);
    newMdatContent.set(mdatAfter, mdatBefore.length + firstSize);
    newMdatContent.set(PADDING_NAL, mdatBefore.length + firstSize + mdatAfter.length);
    const newMdat = buildBox('mdat', newMdatContent);
    const ftypBox = buildFtyp();
    const freeBox = buildFree();
    const mvhdBox = findBox(data, 'mvhd', moov.start + 8, moov.end);
    if (!mvhdBox) throw new Error('No mvhd box');
    const mvhdContent = data.slice(mvhdBox.start + 8, mvhdBox.end);
    const vTkhd = findBox(data, 'tkhd', vt.start + 8, vt.end);
    if (!vTkhd) throw new Error('No video tkhd box');
    const vTkhdDurMs = readU32(dv, vTkhd.start + 28);
    const mvhd = buildMvhd(mvhdContent, vTkhdDurMs);
    const videoTkhd = new Uint8Array(data, vt.start + 8, readU32(dv, vt.start + 8));
    const edts = findBox(data, 'edts', vt.start + 8, vt.end);
    const videoEdts = edts ? data.slice(edts.start, edts.end) : new ArrayBuffer(0);
    const vMdhdBox = findBoxPath(data, ['mdia', 'mdhd'], vt.start + 8, vt.end);
    if (!vMdhdBox) throw new Error('No video mdhd');
    const videoMdhd = data.slice(vMdhdBox.start - 8, vMdhdBox.end);
    const vHdlr = findBoxPath(data, ['mdia', 'hdlr'], vt.start + 8, vt.end);
    if (!vHdlr) throw new Error('No video hdlr');
    const videoHdlr = data.slice(vHdlr.start - 8, vHdlr.end);
    const vmhd = findBoxPath(data, ['mdia', 'minf', 'vmhd'], vt.start + 8, vt.end);
    if (!vmhd) throw new Error('No vmhd');
    const videoVmhd = data.slice(vmhd.start - 8, vmhd.end);
    const dinf = findBoxPath(data, ['mdia', 'minf', 'dinf'], vt.start + 8, vt.end);
    if (!dinf) throw new Error('No dinf');
    const videoDinf = data.slice(dinf.start - 8, dinf.end);
    const stsdContent = new Uint8Array(data, stsd.start + 8, stsd.size - 8);
    const codecEntryType = String.fromCharCode(stsdContent[12], stsdContent[13], stsdContent[14], stsdContent[15]);
    const isHevc = codecEntryType === 'hvc1';
    const codecFixed = stsdContent.slice(16, 94);
    const findBoxInStsd = (type) => { for (let i = 0; i < stsdContent.length - 4; i++) { if (stsdContent[i] === type.charCodeAt(0) && stsdContent[i+1] === type.charCodeAt(1) && stsdContent[i+2] === type.charCodeAt(2) && stsdContent[i+3] === type.charCodeAt(3)) return i - 4; } return -1; };
    const configRel = findBoxInStsd(isHevc ? 'hvcC' : 'avcC');
    let configNew;
    if (configRel >= 0) { const configStart = configRel; const configOrigSize = readU32(new DataView(stsdContent.buffer, stsdContent.byteOffset + configStart), 0); configNew = buildBox(isHevc ? 'hvcC' : 'avcC', stsdContent.slice(configStart + 8, configStart + configOrigSize)); }
    else { configNew = buildBox(isHevc ? 'hvcC' : 'avcC', new Uint8Array(0)); }
    let colrBox = new ArrayBuffer(0);
    for (let i = 0; i < stsdContent.length - 4; i++) { if (stsdContent[i] === 0x63 && stsdContent[i+1] === 0x6f && stsdContent[i+2] === 0x6c && stsdContent[i+3] === 0x72) { const cs = i - 4; colrBox = data.slice(stsd.start + 8 + cs, stsd.start + 8 + cs + readU32(new DataView(stsdContent.buffer, stsdContent.byteOffset + cs), 0)); break; } }
    let paspBox = new ArrayBuffer(0);
    for (let i = 0; i < stsdContent.length - 4; i++) { if (stsdContent[i] === 0x70 && stsdContent[i+1] === 0x61 && stsdContent[i+2] === 0x73 && stsdContent[i+3] === 0x70) { const ps = i - 4; paspBox = data.slice(stsd.start + 8 + ps, stsd.start + 8 + ps + readU32(new DataView(stsdContent.buffer, stsdContent.byteOffset + ps), 0)); break; } }
    const totalVBytes = sampleSizes.reduce((s, v) => s + v, 0) - firstSize + newFirstSize;
    const newVAvgBr = Math.floor(totalVBytes * 8 / vDurationSec);
    let maxBr = newVAvgBr;
    for (let i = 0; i < stsdContent.length - 4; i++) { if (stsdContent[i] === 0x62 && stsdContent[i+1] === 0x74 && stsdContent[i+2] === 0x72 && stsdContent[i+3] === 0x74) { maxBr = readU32(new DataView(stsdContent.buffer, stsdContent.byteOffset + i + 4), 0); break; } }
    const btrtNew = buildBtrt(0, maxBr, newVAvgBr);
    const sampleEntryContent = new Uint8Array(codecFixed.length + configNew.byteLength + colrBox.byteLength + paspBox.byteLength + btrtNew.byteLength);
    sampleEntryContent.set(codecFixed, 0);
    sampleEntryContent.set(new Uint8Array(configNew), codecFixed.length);
    sampleEntryContent.set(new Uint8Array(colrBox), codecFixed.length + configNew.byteLength);
    sampleEntryContent.set(new Uint8Array(paspBox), codecFixed.length + configNew.byteLength + colrBox.byteLength);
    sampleEntryContent.set(new Uint8Array(btrtNew), codecFixed.length + configNew.byteLength + colrBox.byteLength + paspBox.byteLength);
    const sampleEntry = buildBox(codecEntryType, sampleEntryContent);
    const videoStsdNew = buildBox('stsd', new Uint8Array([0,0,0,0, 0,0,0,1, ...new Uint8Array(sampleEntry)]));
    const videoSttsNew = buildStts([[origFrames + padCount, timeDelta]]);
    const videoStss = stss ? data.slice(stss.start, stss.end) : new ArrayBuffer(0);
    const videoSdtp = sdtp ? data.slice(sdtp.start, sdtp.end) : new ArrayBuffer(0);
    const videoCtts = ctts ? data.slice(ctts.start, ctts.end) : new ArrayBuffer(0);
    const newSizes = [newFirstSize, ...sampleSizes.slice(1), ...new Array(padCount).fill(PADDING_SIZE)];
    const videoStszNew = buildStsz(newSizes);
    const newStscEntries = padCount > 0 ? [...stscEntries, [chunkOffsets.length + 1, 1, 1]] : stscEntries;
    const videoStscNew = buildStsc(newStscEntries);
    const totalVChunks = chunkOffsets.length + padCount;
    const stcoPhSize = 16 + totalVChunks * 4;
    const stcoPh = new ArrayBuffer(stcoPhSize);
    const stcoPhDv = new DataView(stcoPh);
    stcoPhDv.setUint32(0, stcoPhSize, false); stcoPhDv.setUint32(4, 0x7374636f, false); stcoPhDv.setUint32(12, totalVChunks, false);
    let vStblParts = [videoStsdNew, videoSttsNew];
    if (stss) vStblParts.push(videoStss);
    if (sdtp) vStblParts.push(videoSdtp);
    if (ctts) vStblParts.push(videoCtts);
    vStblParts.push(videoStscNew, videoStszNew, stcoPh);
    const videoStbl = buildBox('stbl', concatArrayBuffers(vStblParts));
    const videoMinf = buildBox('minf', concatArrayBuffers([videoVmhd, videoDinf, videoStbl]));
    const videoMdia = buildBox('mdia', concatArrayBuffers([videoMdhd, videoHdlr, videoMinf]));
    const videoTrak = buildBox('trak', concatArrayBuffers([videoTkhd, videoEdts, videoMdia]));
    let audioTrak = new ArrayBuffer(0);
    if (hasAudio) {
      const aTkhdBox = findBox(data, 'tkhd', at.start + 8, at.end);
      if (!aTkhdBox) throw new Error('Missing audio tkhd');
      audioTkhd = buildTkhd(data.slice(aTkhdBox.start, aTkhdBox.end), undefined);
      const aEdts = findBox(data, 'edts', at.start + 8, at.end);
      audioEdts = aEdts ? data.slice(aEdts.start, aEdts.end) : new ArrayBuffer(0);
      const aSmhd = findBoxPath(data, ['mdia', 'minf', 'smhd'], at.start + 8, at.end);
      if (!aSmhd) throw new Error('Missing audio smhd');
      audioSmhd = data.slice(aSmhd.start - 8, aSmhd.end);
      const aDinf = findBoxPath(data, ['mdia', 'minf', 'dinf'], at.start + 8, at.end);
      if (!aDinf) throw new Error('Missing audio dinf');
      audioDinf = data.slice(aDinf.start - 8, aDinf.end);
      const aMdhdBox = findBoxPath(data, ['mdia', 'mdhd'], at.start + 8, at.end);
      if (!aMdhdBox) throw new Error('Missing audio mdhd2');
      audioMdhd = buildMdhd(data.slice(aMdhdBox.start, aMdhdBox.end), undefined, LANG_UND);
      audioHdlr = buildHdlr('soun', 'SoundHandler');
      const aStblBox2 = findBoxPath(data, ['mdia', 'minf', 'stbl'], at.start + 8, at.end);
      if (!aStblBox2) throw new Error('Missing audio stbl2');
      const aStsd = findBox(data, 'stsd', aStblBox2.start, aStblBox2.end);
      if (!aStsd) throw new Error('Missing audio stsd');
      let audioStsd = new Uint8Array(data, aStsd.start, aStsd.size);
      const oldBrBytes = new Uint8Array([oldABr >> 24 & 0xff, oldABr >> 16 & 0xff, oldABr >> 8 & 0xff, oldABr & 0xff]);
      const newBrBytes = new Uint8Array([newABr >> 24 & 0xff, newABr >> 16 & 0xff, newABr >> 8 & 0xff, newABr & 0xff]);
      audioStsdArr = new Uint8Array(audioStsd);
      for (let i = 0; i < audioStsdArr.length - 4; i++) {
        if (audioStsdArr[i] === oldBrBytes[0] && audioStsdArr[i+1] === oldBrBytes[1] && audioStsdArr[i+2] === oldBrBytes[2] && audioStsdArr[i+3] === oldBrBytes[3]) {
          audioStsdArr[i] = newBrBytes[0]; audioStsdArr[i+1] = newBrBytes[1]; audioStsdArr[i+2] = newBrBytes[2]; audioStsdArr[i+3] = newBrBytes[3]; break;
        }
      }
      const aStcoAudio = findBox(data, 'stco', aStblBox2.start, aStblBox2.end);
      const aStszAudio = findBox(data, 'stsz', aStblBox2.start, aStblBox2.end);
      const aStscAudio = findBox(data, 'stsc', aStblBox2.start, aStblBox2.end);
      const aSgpdAudio = findBox(data, 'sgpd', aStblBox2.start, aStblBox2.end);
      const aSbgpAudio = findBox(data, 'sbgp', aStblBox2.start, aStblBox2.end);
      if (!aStcoAudio) throw new Error('Missing audio stco2');
      if (!aStszAudio) throw new Error('Missing audio stsz2');
      if (!aStscAudio) throw new Error('Missing audio stsc2');
      audioSttsNewArr = buildStts(newAStts);
      audioStsc = data.slice(aStscAudio.start, aStscAudio.end);
      audioStsz = data.slice(aStszAudio.start, aStszAudio.end);
      const aStcoPhSize = 16 + audioChunks.length * 4;
      const aStcoPh = new ArrayBuffer(aStcoPhSize);
      const aDv = new DataView(aStcoPh);
      aDv.setUint32(0, aStcoPhSize, false); aDv.setUint32(4, 0x7374636f, false); aDv.setUint32(12, audioChunks.length, false);
      aSgpd = aSgpdAudio ? data.slice(aSgpdAudio.start, aSgpdAudio.end) : new ArrayBuffer(0);
      aSbgp = aSbgpAudio ? data.slice(aSbgpAudio.start, aSbgpAudio.end) : new ArrayBuffer(0);
      const aStblParts = [audioStsdArr.buffer, audioSttsNewArr, audioStsc, audioStsz, aStcoPh, aSgpd, aSbgp];
      const audioStbl = buildBox('stbl', concatArrayBuffers(aStblParts));
      const audioMinf = buildBox('minf', concatArrayBuffers([audioSmhd, audioDinf, audioStbl]));
      const audioMdia = buildBox('mdia', concatArrayBuffers([audioMdhd, audioHdlr, audioMinf]));
      audioTrak = buildBox('trak', concatArrayBuffers([audioTkhd, audioEdts, audioMdia]));
    }
    const udta = buildUdtaComment(COMMENT);
    const moovNew = buildBox('moov', concatArrayBuffers([mvhd, videoTrak, audioTrak, udta]));
    const moovSizeFinal = moovNew.byteLength;
    const newMdatStart = 32 + 8 + moovSizeFinal + 8;
    const firstVideoRel = firstOff - mdatDataStart;
    const padAbs = newMdatStart + newMdatContent.length - PADDING_SIZE;
    const newVOffsets = chunkOffsets.map(off => { const rel = off - mdatDataStart; return newMdatStart + (rel <= firstVideoRel ? rel : rel - seiRemoved); });
    for (let i = 0; i < padCount; i++) newVOffsets.push(padAbs);
    const newAOffsets = [];
    if (hasAudio) { for (const off of audioChunks) { const rel = off - mdatDataStart; newAOffsets.push(newMdatStart + (rel < firstVideoRel ? rel : rel - seiRemoved)); } }
    const videoStcoNew = buildStco(newVOffsets);
    vStblParts[vStblParts.length - 1] = videoStcoNew;
    const videoStblFinal = buildBox('stbl', concatArrayBuffers(vStblParts));
    const videoMinfFinal = buildBox('minf', concatArrayBuffers([videoVmhd, videoDinf, videoStblFinal]));
    const videoMdiaFinal = buildBox('mdia', concatArrayBuffers([videoMdhd, videoHdlr, videoMinfFinal]));
    const videoTrakFinal = buildBox('trak', concatArrayBuffers([videoTkhd, videoEdts, videoMdiaFinal]));
    let audioTrakFinal = new ArrayBuffer(0);
    if (hasAudio) {
      const audioStcoFinal = buildStco(newAOffsets);
      const aStblPartsFinal = [audioStsdArr.buffer, audioSttsNewArr, audioStsc, audioStsz, audioStcoFinal, aSgpd, aSbgp];
      const audioStblFinal = buildBox('stbl', concatArrayBuffers(aStblPartsFinal));
      const audioMinfFinal = buildBox('minf', concatArrayBuffers([audioSmhd, audioDinf, audioStblFinal]));
      const audioMdiaFinal = buildBox('mdia', concatArrayBuffers([audioMdhd, audioHdlr, audioMinfFinal]));
      audioTrakFinal = buildBox('trak', concatArrayBuffers([audioTkhd, audioEdts, audioMdiaFinal]));
    }
    const moovFinal = buildBox('moov', concatArrayBuffers([mvhd, videoTrakFinal, audioTrakFinal, udta]));
    if (moovFinal.byteLength !== moovSizeFinal) throw new Error('Moov size mismatch');
    return concatArrayBuffers([ftypBox, freeBox, moovFinal, newMdat]);
  }

  // ===== UI =====
  const ICON_URL = 'data:image/png;base64,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';

  function addButton() {
    if (document.getElementById('tk-bypass-btn')) return;
    if (!document.body) { setTimeout(addButton, 300); return; }
    const btn = document.createElement('div');
    btn.id = 'tk-bypass-btn';
    btn.title = 'Process video with quality bypass';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: '99999',
      width: '48px', height: '48px', borderRadius: '50%',
      backgroundImage: 'url(' + ICON_URL + ')',
      backgroundSize: 'cover', backgroundPosition: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      userSelect: 'none', transition: 'transform .15s'
    });
    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
    btn.addEventListener('click', openFilePicker);
    document.body.appendChild(btn);
  }

  let processing = false;
  function openFilePicker() {
    if (processing) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp4,video/mp4';
    input.addEventListener('change', () => { if (input.files.length) processFile(input.files[0]); });
    input.click();
  }

  function processFile(file) {
    if (!file.name.toLowerCase().endsWith('.mp4')) { alert('Please select an MP4 file.'); return; }
    processing = true;
    const btn = document.getElementById('tk-bypass-btn');
    if (btn) { btn.style.opacity = '0.5'; btn.style.transform = 'scale(1)'; }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const patched = transform(e.target.result, MIN_DECLARED);
        const blob = new Blob([patched], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name.replace('.mp4', '_tiktok.mp4');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        if (btn) btn.style.opacity = '1';
      } catch (err) {
        console.error('TikTok Bypass:', err);
        alert('Error processing ' + file.name + ': ' + err.message);
      }
      processing = false;
      if (btn) btn.style.opacity = '1';
    };
    reader.onerror = function() { alert('Failed to read file'); processing = false; if (btn) btn.style.opacity = '1'; };
    reader.readAsArrayBuffer(file);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addButton);
  } else {
    addButton();
  }
})();
