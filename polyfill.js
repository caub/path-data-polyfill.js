// @info
//   Polyfill for SVG 2 getPathData() and setPathData() methods. Based on:
//   - SVGPathSeg polyfill by Philip Rogers (MIT License)
//     https://github.com/progers/pathseg
//   - SVGPathNormalizer by Tadahisa Motooka (MIT License)
//     https://github.com/motooka/SVGPathNormalizer/tree/master/src
//   - arcToCubicCurves() by Dmitry Baranovskiy (MIT License)
//     https://github.com/DmitryBaranovskiy/raphael/blob/v2.1.1/raphael.core.js#L1837
// @author
//   Jarosław Foksa
// @license
//   MIT License

const commandsMap = {
  "Z":"Z", "M":"M", "L":"L", "C":"C", "Q":"Q", "A":"A", "H":"H", "V":"V", "S":"S", "T":"T",
  "z":"Z", "m":"m", "l":"l", "c":"c", "q":"q", "a":"a", "h":"h", "v":"v", "s":"s", "t":"t"
};

class Source {
  constructor(string) {
    this._string = string;
    this._currentIndex = 0;
    this._endIndex = this._string.length;
    this._prevCommand = null;

    this._skipOptionalSpaces();
  }

  parseSegment() {
    const char = this._string[this._currentIndex];
    let command = commandsMap[char] ? commandsMap[char] : null;

    if (command === null) {
      if (this._prevCommand === null) {
        return null;
      }

      if (
        (char === "+" || char === "-" || char === "." || (char >= "0" && char <= "9")) && this._prevCommand !== "Z"
      ) {
        if (this._prevCommand === "M") {
          command = "L";
        }
        else if (this._prevCommand === "m") {
          command = "l";
        }
        else {
          command = this._prevCommand;
        }
      }
      else {
        command = null;
      }

      if (command === null) {
        return null;
      }
    }
    else {
      this._currentIndex += 1;
    }

    this._prevCommand = command;

    let values = null;
    const cmd = command.toUpperCase();

    if (cmd === "H" || cmd === "V") {
      values = [this._parseNumber()];
    }
    else if (cmd === "M" || cmd === "L" || cmd === "T") {
      values = [this._parseNumber(), this._parseNumber()];
    }
    else if (cmd === "S" || cmd === "Q") {
      values = [this._parseNumber(), this._parseNumber(), this._parseNumber(), this._parseNumber()];
    }
    else if (cmd === "C") {
      values = [
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber()
      ];
    }
    else if (cmd === "A") {
      values = [
        this._parseNumber(),
        this._parseNumber(),
        this._parseNumber(),
        this._parseArcFlag(),
        this._parseArcFlag(),
        this._parseNumber(),
        this._parseNumber()
      ];
    }
    else if (cmd === "Z") {
      this._skipOptionalSpaces();
      values = [];
    }

    if (values === null || values.indexOf(null) >= 0) {
      return null;
    }
    else {
      return {type: command, values: values};
    }
  }

  hasMoreData() {
    return this._currentIndex < this._endIndex;
  }

  peekSegmentType() {
    const char = this._string[this._currentIndex];
    return commandsMap[char] ? commandsMap[char] : null;
  }

  initialCommandIsMoveTo() {
    if (!this.hasMoreData()) {
      return true;
    }

    const command = this.peekSegmentType();
    return command === "M" || command === "m";
  }

  _isCurrentSpace() {
    const char = this._string[this._currentIndex];
    return char <= " " && (char === " " || char === "\n" || char === "\t" || char === "\r" || char === "\f");
  }

  _skipOptionalSpaces() {
    while (this._currentIndex < this._endIndex && this._isCurrentSpace()) {
      this._currentIndex += 1;
    }

    return this._currentIndex < this._endIndex;
  }

  _skipOptionalSpacesOrDelimiter() {
    if (
      this._currentIndex < this._endIndex &&
      !this._isCurrentSpace() &&
      this._string[this._currentIndex] !== ","
    ) {
      return false;
    }

    if (this._skipOptionalSpaces()) {
      if (this._currentIndex < this._endIndex && this._string[this._currentIndex] === ",") {
        this._currentIndex += 1;
        this._skipOptionalSpaces();
      }
    }
    return this._currentIndex < this._endIndex;
  }

  _parseNumber() {
    let exponent = 0;
    let integer = 0;
    let frac = 1;
    let decimal = 0;
    let sign = 1;
    let expsign = 1;
    const startIndex = this._currentIndex;

    this._skipOptionalSpaces();

    if (this._currentIndex < this._endIndex && this._string[this._currentIndex] === "+") {
      this._currentIndex += 1;
    }
    else if (this._currentIndex < this._endIndex && this._string[this._currentIndex] === "-") {
      this._currentIndex += 1;
      sign = -1;
    }

    if (
      this._currentIndex === this._endIndex ||
      (
        (this._string[this._currentIndex] < "0" || this._string[this._currentIndex] > "9") &&
        this._string[this._currentIndex] !== "."
      )
    ) {
      return null;
    }

    let startIntPartIndex = this._currentIndex;

    while (
      this._currentIndex < this._endIndex &&
      this._string[this._currentIndex] >= "0" &&
      this._string[this._currentIndex] <= "9"
    ) {
      this._currentIndex += 1;
    }

    if (this._currentIndex !== startIntPartIndex) {
      let scanIntPartIndex = this._currentIndex - 1;
      let multiplier = 1;

      while (scanIntPartIndex >= startIntPartIndex) {
        integer += multiplier * (this._string[scanIntPartIndex] - "0");
        scanIntPartIndex -= 1;
        multiplier *= 10;
      }
    }

    if (this._currentIndex < this._endIndex && this._string[this._currentIndex] === ".") {
      this._currentIndex += 1;

      if (
        this._currentIndex >= this._endIndex ||
        this._string[this._currentIndex] < "0" ||
        this._string[this._currentIndex] > "9"
      ) {
        return null;
      }

      while (
        this._currentIndex < this._endIndex &&
        this._string[this._currentIndex] >= "0" &&
        this._string[this._currentIndex] <= "9"
      ) {
        frac *= 10;
        decimal += (this._string.charAt(this._currentIndex) - "0") / frac;
        this._currentIndex += 1;
      }
    }

    if (
      this._currentIndex !== startIndex &&
      this._currentIndex + 1 < this._endIndex &&
      (this._string[this._currentIndex] === "e" || this._string[this._currentIndex] === "E") &&
      (this._string[this._currentIndex + 1] !== "x" && this._string[this._currentIndex + 1] !== "m")
    ) {
      this._currentIndex += 1;

      if (this._string[this._currentIndex] === "+") {
        this._currentIndex += 1;
      }
      else if (this._string[this._currentIndex] === "-") {
        this._currentIndex += 1;
        expsign = -1;
      }

      if (
        this._currentIndex >= this._endIndex ||
        this._string[this._currentIndex] < "0" ||
        this._string[this._currentIndex] > "9"
      ) {
        return null;
      }

      while (
        this._currentIndex < this._endIndex &&
        this._string[this._currentIndex] >= "0" &&
        this._string[this._currentIndex] <= "9"
      ) {
        exponent *= 10;
        exponent += (this._string[this._currentIndex] - "0");
        this._currentIndex += 1;
      }
    }

    let number = integer + decimal;
    number *= sign;

    if (exponent) {
      number *= Math.pow(10, expsign * exponent);
    }

    if (startIndex === this._currentIndex) {
      return null;
    }

    this._skipOptionalSpacesOrDelimiter();

    return number;
  }

  _parseArcFlag() {
    if (this._currentIndex >= this._endIndex) {
      return null;
    }

    let flag = null;
    const flagChar = this._string[this._currentIndex];

    this._currentIndex += 1;

    if (flagChar === "0") {
      flag = 0;
    }
    else if (flagChar === "1") {
      flag = 1;
    }
    else {
      return null;
    }

    this._skipOptionalSpacesOrDelimiter();
    return flag;
  }
}


const degToRad = degrees => Math.PI * degrees / 180;

const rotate = (x, y, angleRad) => ({
  x: x * Math.cos(angleRad) - y * Math.sin(angleRad),
  y: x * Math.sin(angleRad) + y * Math.cos(angleRad)
});

// @info
//   Get an array of corresponding cubic bezier curve parameters for given arc curve paramters.
const arcToCubicCurves = (x1, y1, x2, y2, r1, r2, angle, largeArcFlag, sweepFlag, _recursive) => {
  
  const angleRad = degToRad(angle);
  let params = [];
  let f1, f2, cx, cy;

  if (_recursive) {
    f1 = _recursive[0];
    f2 = _recursive[1];
    cx = _recursive[2];
    cy = _recursive[3];
  }
  else {
    const {x: x1, y: y1} = rotate(x1, y1, -angleRad);

    const {x: x2, y: y2} = rotate(x2, y2, -angleRad);

    const x = (x1 - x2) / 2;
    const y = (y1 - y2) / 2;
    let h = (x * x) / (r1 * r1) + (y * y) / (r2 * r2);

    if (h > 1) {
      h = Math.sqrt(h);
      r1 = h * r1;
      r2 = h * r2;
    }

    const sign = largeArcFlag === sweepFlag ? -1 : 1;

    const r1Pow = r1 * r1;
    const r2Pow = r2 * r2;

    const left = r1Pow * r2Pow - r1Pow * y * y - r2Pow * x * x;
    const right = r1Pow * y * y + r2Pow * x * x;

    const k = sign * Math.sqrt(Math.abs(left/right));

    cx = k * r1 * y / r2 + (x1 + x2) / 2;
    cy = k * -r2 * x / r1 + (y1 + y2) / 2;

    f1 = Math.asin(Math.round((y1 - cy) / r2 * 1e9) / 1e9);
    f2 = Math.asin(Math.round((y2 - cy) / r2 * 1e9) / 1e9);

    if (x1 < cx) {
      f1 = Math.PI - f1;
    }
    if (x2 < cx) {
      f2 = Math.PI - f2;
    }

    if (f1 < 0) {
      f1 = Math.PI * 2 + f1;
    }
    if (f2 < 0) {
      f2 = Math.PI * 2 + f2;
    }

    if (sweepFlag && f1 > f2) {
      f1 = f1 - Math.PI * 2;
    }
    if (!sweepFlag && f2 > f1) {
      f2 = f2 - Math.PI * 2;
    }
  }

  let df = f2 - f1;

  if (Math.abs(df) > Math.PI * 120 / 180) {
    const f2old = f2;
    const x2old = x2;
    const y2old = y2;

    if (sweepFlag && f2 > f1) {
      f2 = f1 + (Math.PI * 120 / 180) * (1);
    }
    else {
      f2 = f1 + (Math.PI * 120 / 180) * (-1);
    }

    x2 = cx + r1 * Math.cos(f2);
    y2 = cy + r2 * Math.sin(f2);
    params = arcToCubicCurves(x2, y2, x2old, y2old, r1, r2, angle, 0, sweepFlag, [f2, f2old, cx, cy]);
  }

  df = f2 - f1;

  const c1 = Math.cos(f1);
  const s1 = Math.sin(f1);
  const c2 = Math.cos(f2);
  const s2 = Math.sin(f2);
  const t = Math.tan(df / 4);
  const hx = 4 / 3 * r1 * t;
  const hy = 4 / 3 * r2 * t;

  const m1 = [x1, y1];
  const m2 = [x1 + hx * s1, y1 - hy * c1];
  const m3 = [x2 + hx * s2, y2 - hy * c2];
  const m4 = [x2, y2];

  m2[0] = 2 * m1[0] - m2[0];
  m2[1] = 2 * m1[1] - m2[1];

  if (_recursive) {
    return [m2, m3, m4].concat(params);
  }
  else {
    params = [m2, m3, m4].concat(params).join().split(",");

    const newParams = [];

    for (let i = 0; i< params.length; i++) {
      newParams[i] = i % 2 ? 
        rotate(params[i - 1], params[i], angleRad).y :
        rotate(params[i], params[i + 1], angleRad).x;
    }

    return newParams;
  }
};

// @info
//   Takes any path data, returns path data that consists only from absolute commands.
function absolutizePathData(pathData) {
  const absolutizedPathData = [];

  let currentX = null;
  let currentY = null;

  let subpathX = null;
  let subpathY = null;

  for (const seg of pathData) {
    const type = seg.type;

    if (type === "M") {
      const [x, y] = seg.values;

      absolutizedPathData.push({type: "M", values: [x, y]});

      subpathX = x;
      subpathY = y;

      currentX = x;
      currentY = y;
    }

    else if (type === "m") {
      let [x, y] = seg.values;

      x += currentX;
      y += currentY;

      absolutizedPathData.push({type: "M", values: [x, y]});

      subpathX = x;
      subpathY = y;

      currentX = x;
      currentY = y;
    }

    else if (type === "L") {
      const [x, y] = seg.values;

      absolutizedPathData.push({type: "L", values: [x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "l") {
      let [x, y] = seg.values;

      x += currentX;
      y += currentY;

      absolutizedPathData.push({type: "L", values: [x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "C") {
      const [x1, y1, x2, y2, x, y] = seg.values;

      absolutizedPathData.push({type: "C", values: [x1, y1, x2, y2, x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "c") {
      let [x1, y1, x2, y2, x, y] = seg.values;

      x1 += currentX;
      y1 += currentY;
      x2 += currentX;
      y2 += currentY;
      x += currentX;
      y += currentY;

      absolutizedPathData.push({type: "C", values: [x1, y1, x2, y2, x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "Q") {
      const [x1, y1, x, y] = seg.values;

      absolutizedPathData.push({type: "Q", values: [x1, y1, x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "q") {
      let [x1, y1, x, y] = seg.values;

      x1 += currentX;
      y1 += currentY;
      x += currentX;
      y += currentY;

      absolutizedPathData.push({type: "Q", values: [x1, y1, x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "A") {
      const [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y] = seg.values;

      absolutizedPathData.push({
        type: "A",
        values: [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y]
      });

      currentX = x;
      currentY = y;
    }

    else if (type === "a") {
      let [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y] = seg.values;

      x += currentX;
      y += currentY;

      absolutizedPathData.push({
        type: "A",
        values: [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y]
      });

      currentX = x;
      currentY = y;
    }

    else if (type === "H") {
      const [x] = seg.values;
      absolutizedPathData.push({type: "H", values: [x]});
      currentX = x;
    }

    else if (type === "h") {
      let [x] = seg.values;
      x += currentX;

      absolutizedPathData.push({type: "H", values: [x]});
      currentX = x;
    }

    else if (type === "V") {
      const [y] = seg.values;

      absolutizedPathData.push({type: "V", values: [y]});
      currentY = y;
    }

    else if (type === "v") {
      let [y] = seg.values;
      y += currentY;

      absolutizedPathData.push({type: "V", values: [y]});
      currentY = y;
    }

    else if (type === "S") {
      const [x2, y2, x, y] = seg.values;

      absolutizedPathData.push({type: "S", values: [x2, y2, x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "s") {
      let [x2, y2, x, y] = seg.values;

      x2 += currentX;
      y2 += currentY;
      x += currentX;
      y += currentY;

      absolutizedPathData.push({type: "S", values: [x2, y2, x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "T") {
      const [x, y] = seg.values;

      absolutizedPathData.push({type: "T", values: [x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "t") {
      let [x, y] = seg.values;

      x += currentX;
      y += currentY;

      absolutizedPathData.push({type: "T", values: [x, y]});

      currentX = x;
      currentY = y;
    }

    else if (type === "Z" || type === "z") {
      absolutizedPathData.push({type: "Z", values: []});

      currentX = subpathX;
      currentY = subpathY;
    }
  }

  return absolutizedPathData;
};

// @info
//   Takes path data that consists only from absolute commands, returns path data that consists only from
//   "M", "L", "C" and "Z" commands.
function reducePathData(pathData) {
  const reducedPathData = [];
  let lastType = null;

  let lastControlX = null;
  let lastControlY = null;

  let currentX = null;
  let currentY = null;

  let subpathX = null;
  let subpathY = null;

  for (const seg of pathData) {
    if (seg.type === "M") {
      const [x, y] = seg.values;

      reducedPathData.push({type: "M", values: [x, y]});

      subpathX = x;
      subpathY = y;

      currentX = x;
      currentY = y;
    }

    else if (seg.type === "C") {
      const [x1, y1, x2, y2, x, y] = seg.values;

      reducedPathData.push({type: "C", values: [x1, y1, x2, y2, x, y]});

      lastControlX = x2;
      lastControlY = y2;

      currentX = x;
      currentY = y;
    }

    else if (seg.type === "L") {
      const [x, y] = seg.values;

      reducedPathData.push({type: "L", values: [x, y]});

      currentX = x;
      currentY = y;
    }

    else if (seg.type === "H") {
      const [x] = seg.values;

      reducedPathData.push({type: "L", values: [x, currentY]});

      currentX = x;
    }

    else if (seg.type === "V") {
      const [y] = seg.values;

      reducedPathData.push({type: "L", values: [currentX, y]});

      currentY = y;
    }

    else if (seg.type === "S") {
      const [x2, y2, x, y] = seg.values;
      let cx1, cy1;

      if (lastType === "C" || lastType === "S") {
        cx1 = currentX + (currentX - lastControlX);
        cy1 = currentY + (currentY - lastControlY);
      }
      else {
        cx1 = currentX;
        cy1 = currentY;
      }

      reducedPathData.push({type: "C", values: [cx1, cy1, x2, y2, x, y]});

      lastControlX = x2;
      lastControlY = y2;

      currentX = x;
      currentY = y;
    }

    else if (seg.type === "T") {
      const [x, y] = seg.values;
      let x1, y1;

      if (lastType === "Q" || lastType === "T") {
        x1 = currentX + (currentX - lastControlX);
        y1 = currentY + (currentY - lastControlY);
      }
      else {
        x1 = currentX;
        y1 = currentY;
      }

      const cx1 = currentX + 2 * (x1 - currentX) / 3;
      const cy1 = currentY + 2 * (y1 - currentY) / 3;
      const cx2 = x + 2 * (x1 - x) / 3;
      const cy2 = y + 2 * (y1 - y) / 3;

      reducedPathData.push({type: "C", values: [cx1, cy1, cx2, cy2, x, y]});

      lastControlX = x1;
      lastControlY = y1;

      currentX = x;
      currentY = y;
    }

    else if (seg.type === "Q") {
      const [x1, y1, x, y] = seg.values;
      const cx1 = currentX + 2 * (x1 - currentX) / 3;
      const cy1 = currentY + 2 * (y1 - currentY) / 3;
      const cx2 = x + 2 * (x1 - x) / 3;
      const cy2 = y + 2 * (y1 - y) / 3;

      reducedPathData.push({type: "C", values: [cx1, cy1, cx2, cy2, x, y]});

      lastControlX = x1;
      lastControlY = y1;

      currentX = x;
      currentY = y;
    }

    else if (seg.type === "A") {
      const [r1, r2, angle, largeArcFlag, sweepFlag, x, y] = seg.values;

      if (r1 === 0 || r2 === 0) {
        reducedPathData.push({type: "C", values: [currentX, currentY, x, y, x, y]});

        currentX = x;
        currentY = y;
      }
      else {
        if (currentX !== x || currentY !== y) {
          const curves = arcToCubicCurves(currentX, currentY, x, y, r1, r2, angle, largeArcFlag, sweepFlag);

          curves.forEach( function(curve) {
            reducedPathData.push({type: "C", values: curve});

            currentX = x;
            currentY = y;
          });
        }
      }
    }

    else if (seg.type === "Z") {
      reducedPathData.push(seg);

      currentX = subpathX;
      currentY = subpathY;
    }

    lastType = seg.type;
  }

  return reducedPathData;
};



exports.parsePathData = (string, normalize) => {
  if (!string) return [];

  const source = new Source(string);
  const pathData = [];

  if (source.initialCommandIsMoveTo()) {
    while (source.hasMoreData()) {
      let pathSeg = source.parseSegment();

      if (pathSeg === null) {
        break;
      }
      else {
        pathData.push(pathSeg);
      }
    }
  }

  return normalize ? reducePathData(absolutizePathData(pathData)) : pathData;
};


exports.clonePathData = (pathData) => {
  return pathData.map((seg) => {
    return {type: seg.type, values: [...seg.values]}
  });
};


exports.getRectPathData = function(options) {
  const x = this.x.baseVal.value;
  const y = this.y.baseVal.value;
  const width = this.width.baseVal.value;
  const height = this.height.baseVal.value;
  let rx = this.hasAttribute("rx") ? this.rx.baseVal.value : this.ry.baseVal.value;
  let ry = this.hasAttribute("ry") ? this.ry.baseVal.value : this.rx.baseVal.value;

  if (rx > width / 2) {
    rx = width / 2;
  }

  if (ry > height / 2) {
    ry = height / 2;
  }

  let pathData = [
    {type: "M", values: [x+rx, y]},
    {type: "H", values: [x+width-rx]},
    {type: "A", values: [rx, ry, 0, 0, 1, x+width, y+ry]},
    {type: "V", values: [y+height-ry]},
    {type: "A", values: [rx, ry, 0, 0, 1, x+width-rx, y+height]},
    {type: "H", values: [x+rx]},
    {type: "A", values: [rx, ry, 0, 0, 1, x, y+height-ry]},
    {type: "V", values: [y+ry]},
    {type: "A", values: [rx, ry, 0, 0, 1, x+rx, y]},
    {type: "Z", values: []}
  ];

  // Get rid of redundant "A" segs when either rx or ry is 0
  pathData = pathData.filter(s => s.type === "A" && (s.values[0] === 0 || s.values[1] === 0) ? false : true);

  if (options && options.normalize === true) {
    pathData = reducePathData(pathData);
  }

  return pathData;
};

exports.getCirclePathData = function(options) {
  const cx = this.cx.baseVal.value;
  const cy = this.cy.baseVal.value;
  const r = this.r.baseVal.value;

  let pathData = [
    { type: "M",  values: [cx + r, cy] },
    { type: "A",  values: [r, r, 0, 0, 1, cx, cy+r] },
    { type: "A",  values: [r, r, 0, 0, 1, cx-r, cy] },
    { type: "A",  values: [r, r, 0, 0, 1, cx, cy-r] },
    { type: "A",  values: [r, r, 0, 0, 1, cx+r, cy] },
    { type: "Z",  values: [] }
  ];

  if (options && options.normalize === true) {
    pathData = reducePathData(pathData);
  }

  return pathData;
};

exports.getEllipsePathData = function(options) {
  const cx = this.cx.baseVal.value;
  const cy = this.cy.baseVal.value;
  const rx = this.rx.baseVal.value;
  const ry = this.ry.baseVal.value;

  let pathData = [
    { type: "M",  values: [cx + rx, cy] },
    { type: "A",  values: [rx, ry, 0, 0, 1, cx, cy+ry] },
    { type: "A",  values: [rx, ry, 0, 0, 1, cx-rx, cy] },
    { type: "A",  values: [rx, ry, 0, 0, 1, cx, cy-ry] },
    { type: "A",  values: [rx, ry, 0, 0, 1, cx+rx, cy] },
    { type: "Z",  values: [] }
  ];

  if (options && options.normalize === true) {
    pathData = reducePathData(pathData);
  }

  return pathData;
};

exports.getLinePathData = function() {
  return [
    { type: "M", values: [this.x1.baseVal.value, this.y1.baseVal.value] },
    { type: "L", values: [this.x2.baseVal.value, this.y2.baseVal.value] }
  ];
};

exports.getPolylinePathData = function() {
  const pathData = [];

  for (let i = 0; i < this.points.numberOfItems; i += 1) {
    const point = this.points.getItem(i);

    pathData.push({
      type: (i === 0 ? "M" : "L"),
      values: [point.x, point.y]
    });
  }

  return pathData;
};

exports.getPolygonPathData = function() {
  const pathData = [];

  for (let i = 0; i < this.points.numberOfItems; i += 1) {
    const point = this.points.getItem(i);

    pathData.push({
      type: (i === 0 ? "M" : "L"),
      values: [point.x, point.y]
    });
  }

  pathData.push({
    type: "Z",
    values: []
  });

  return pathData;
};
