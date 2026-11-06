import {
  Application,
  Container,
  Graphics,
  Sprite,
  Texture,
  BlurFilter,
  NoiseFilter,
  ColorMatrixFilter,
  Filter,
  GlProgram,
  Rectangle,
} from "pixi.js";
import "pixi.js/advanced-blend-modes";
import {
  type Layer,
  type Project,
  type Profile,
  type Asset,
  type Effect,
  type Point,
} from "./model";
import { bind, graphemes, resolve, type Resolved } from "./document";
import { splitCells, clipHalf, rect, particles, seeded } from "./geometry";
import { loadFont, loadImage } from "./assets";
const vertex = `precision highp float;
in vec2 aPosition; out vec2 vTextureCoord; uniform vec4 uInputSize; uniform vec4 uOutputFrame; uniform vec4 uOutputTexture;
void main(){vec2 p=aPosition*uOutputFrame.zw+uOutputFrame.xy;p.x=p.x*(2.0/uOutputTexture.x)-1.0;p.y=p.y*(2.0*uOutputTexture.z/uOutputTexture.y)-uOutputTexture.z;gl_Position=vec4(p,0.,1.);vTextureCoord=aPosition*(uOutputFrame.zw*uInputSize.zw);}`;
const variableFragment = `precision highp float;
in vec2 vTextureCoord;out vec4 finalColor;uniform sampler2D uTexture;uniform vec4 uInputSize;uniform vec4 uInputClamp;uniform float strength;uniform float reverseMask;uniform float curve;uniform float feather;uniform vec4 region;uniform float ellipse;
void main(){vec2 uv=vTextureCoord;vec2 normalized=uv/max(uInputClamp.zw,vec2(.0001));vec2 p=(normalized-region.xy)/max(region.zw,vec2(.001));vec2 q=abs(p-.5)*2.;float d=mix(max(q.x,q.y),length(q),ellipse);float mask=1.-smoothstep(1.-max(feather,.001),1.,d);mask=mix(mask,1.-mask,reverseMask);float radius=strength*pow(mask,curve);vec4 sum=vec4(0.);float total=0.;for(int x=-4;x<=4;x++){for(int y=-4;y<=4;y++){float weight=exp(-float(x*x+y*y)/8.);vec2 at=clamp(uv+vec2(float(x),float(y))*radius*.25*uInputSize.zw,uInputClamp.xy,uInputClamp.zw);sum+=texture(uTexture,at)*weight;total+=weight;}}finalColor=sum/total;}`;
const inkFragment = `precision highp float;
in vec2 vTextureCoord;out vec4 finalColor;uniform sampler2D uTexture;uniform float threshold;void main(){vec4 c=texture(uTexture,vTextureCoord);float a=smoothstep(threshold-.08,threshold+.08,c.a);finalColor=vec4(c.rgb/max(c.a,.0001)*a,a);}`;
export interface RenderReport {
  ms: number;
  textures: number;
  estimatedBytes: number;
  passes: string[];
  warnings: string[];
  engine: string;
}
export class StudioRenderer {
  app = new Application();
  textures: Texture[] = [];
  filters: Filter[] = [];
  report: RenderReport = {
    ms: 0,
    textures: 0,
    estimatedBytes: 0,
    passes: [],
    warnings: [],
    engine: "PixiJS WebGL",
  };
  ready = false;
  lost = false;
  async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      preference: "webgl",
      preferWebGLVersion: 2,
      width: 1200,
      height: 630,
      antialias: true,
      resolution: 1,
      autoStart: false,
      backgroundAlpha: 0,
      preserveDrawingBuffer: true,
    });
    this.ready = true;
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.lost = false;
    });
  }
  clear() {
    this.app.stage
      .removeChildren()
      .forEach((c) => c.destroy({ children: true }));
    this.filters.forEach((f) => f.destroy());
    this.filters = [];
    this.textures.forEach((t) => t.destroy(true));
    this.textures = [];
  }
  destroy() {
    if (!this.ready) return;
    this.clear();
    this.app.destroy(false);
    this.ready = false;
  }
  texture(source: HTMLCanvasElement | HTMLImageElement) {
    const t = Texture.from(source);
    this.textures.push(t);
    return t;
  }
  fx(effects: Effect[]): Filter[] {
    const result: Filter[] = [];
    for (const e of effects.filter((e) => e.enabled)) {
      let f: Filter;
      if (e.type === "blur")
        f = new BlurFilter({ strength: e.amount, quality: 5 });
      else if (e.type === "noise")
        f = new NoiseFilter({
          noise: e.amount / 100,
          seed: (e.seed % 10000) / 10000,
        });
      else if (e.type === "variableBlur")
        f = new Filter({
          glProgram: GlProgram.from({ vertex, fragment: variableFragment }),
          resources: {
            params: {
              strength: { value: e.amount, type: "f32" },
              reverseMask: { value: e.reverse ? 1 : 0, type: "f32" },
              curve: { value: e.curve, type: "f32" },
              feather: { value: e.feather, type: "f32" },
              region: { value: e.region, type: "vec4<f32>" },
              ellipse: { value: e.shape === "ellipse" ? 1 : 0, type: "f32" },
            },
          },
        });
      else if (e.type === "ink") {
        const blur = new BlurFilter({
          strength: Math.max(0.5, e.amount / 5),
          quality: 4,
        });
        result.push(blur);
        this.filters.push(blur);
        f = new Filter({
          glProgram: GlProgram.from({ vertex, fragment: inkFragment }),
          resources: { params: { threshold: { value: 0.3, type: "f32" } } },
        });
      } else {
        const cm = new ColorMatrixFilter();
        if (e.type === "brightness") cm.brightness(e.amount / 100, false);
        else if (e.type === "saturation") cm.saturate(e.amount / 50 - 1, false);
        else cm.tint(parseInt(e.color.slice(1), 16), false);
        f = cm;
      }
      result.push(f);
      this.filters.push(f);
      this.report.passes.push(`FX:${e.type}`);
    }
    return result;
  }
  polygon(poly: Point[]) {
    return new Graphics().poly(poly.flat()).fill(0xffffff);
  }
  shape(n: Layer, w: number, h: number) {
    const g = new Graphics();
    if (n.mask === "ellipse") g.ellipse(w / 2, h / 2, w / 2, h / 2);
    else {
      const [tl, tr, br, bl] = n.radii.map((r) =>
        Math.max(0, Math.min(r, w / 2, h / 2)),
      );
      g.moveTo(tl, 0)
        .lineTo(w - tr, 0)
        .quadraticCurveTo(w, 0, w, tr)
        .lineTo(w, h - br)
        .quadraticCurveTo(w, h, w - br, h)
        .lineTo(bl, h)
        .quadraticCurveTo(0, h, 0, h - bl)
        .lineTo(0, tl)
        .quadraticCurveTo(0, 0, tl, 0)
        .closePath();
    }
    return g;
  }
  canvas(w: number, h: number) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  gradient(n: Layer, w: number, h: number) {
    const c = this.canvas(w, h),
      ctx = c.getContext("2d")!;
    const a = (n.gradient.angle * Math.PI) / 180;
    const g =
      n.gradient.kind === "radial"
        ? ctx.createRadialGradient(
            w / 2,
            h / 2,
            0,
            w / 2,
            h / 2,
            Math.max(w, h) / 2,
          )
        : ctx.createLinearGradient(
            w / 2 - (Math.cos(a) * w) / 2,
            h / 2 - (Math.sin(a) * h) / 2,
            w / 2 + (Math.cos(a) * w) / 2,
            h / 2 + (Math.sin(a) * h) / 2,
          );
    for (const stop of n.gradient.stops) {
      const rgb = [1, 3, 5].map((i) =>
        parseInt(stop.color.slice(i, i + 2), 16),
      );
      g.addColorStop(
        n.gradient.reverse ? 1 - stop.offset : stop.offset,
        `rgba(${rgb.join(",")},${stop.alpha})`,
      );
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return c;
  }
  textCanvas(n: Layer, w: number, h: number, p: Project, profile: Profile) {
    const c = this.canvas(w, h),
      ctx = c.getContext("2d")!,
      size = n.fontUnit === "ratio" ? n.fontSize * profile.width : n.fontSize;
    ctx.font = `${n.fontWeight} ${size}px ${n.fontAssetId ? `asset-${n.fontAssetId}` : n.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    const content = bind(n.text, p, profile),
      lines: string[][] = [];
    for (const paragraph of content.split("\n")) {
      let row: string[] = [],
        width = 0;
      for (const ch of graphemes(paragraph)) {
        const cw = ctx.measureText(ch).width + n.letterSpacing;
        if (width + cw > w - 2 * n.padding && row.length) {
          lines.push(row);
          row = [];
          width = 0;
        }
        row.push(ch);
        width += cw;
      }
      lines.push(row);
    }
    if (n.textBackground) {
      ctx.fillStyle = n.textBackground;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, n.radii);
      ctx.fill();
    }
    if (n.shadow) {
      ctx.shadowColor = "#00000088";
      ctx.shadowBlur = n.shadow;
      ctx.shadowOffsetY = n.shadow / 3;
    }
    const fill =
      n.fill === "gradient"
        ? ctx.createPattern(this.gradient(n, w, h), "no-repeat")!
        : n.fill;
    let y = n.padding;
    for (const row of lines) {
      const widths = row.map(
          (ch) => ctx.measureText(ch).width + n.letterSpacing,
        ),
        total = widths.reduce((s, x) => s + x, 0);
      let x =
        n.align === "left"
          ? n.padding
          : n.align === "center"
            ? (w - total) / 2
            : w - total - n.padding;
      for (let i = 0; i < row.length; i++) {
        if (n.charBackground) {
          ctx.fillStyle = n.charBackground;
          ctx.beginPath();
          ctx.arc(
            x + widths[i] / 2,
            y + size * 0.53,
            Math.max(size, widths[i]) * 0.55,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        if (n.strokeWidth) {
          ctx.strokeStyle = n.stroke;
          ctx.lineWidth = n.strokeWidth;
          ctx.strokeText(row[i], x, y);
        }
        ctx.fillStyle = fill;
        ctx.fillText(row[i], x, y);
        x += widths[i];
      }
      y += size * n.lineHeight;
    }
    return c;
  }
  async render(
    p: Project,
    profile: Profile,
    assets: Asset[],
    getBlob: (id: string) => Promise<Blob | undefined>,
    stageLimit = "final",
  ): Promise<{ resolved: Resolved; report: RenderReport }> {
    if (this.lost) throw Error("ERR_WEBGL_CONTEXT_LOST");
    const start = performance.now();
    this.clear();
    this.app.renderer.resize(profile.width, profile.height);
    this.report = {
      ms: 0,
      textures: 0,
      estimatedBytes: profile.width * profile.height * 4,
      passes: [],
      warnings: [],
      engine: "PixiJS 8 / WebGL2",
    };
    const resolved = resolve(p, profile);
    const imageMap = new Map<string, Texture>();
    const usedFonts = new Set(
      resolved.layers.map((n) => n.fontAssetId).filter(Boolean),
    );
    for (const fid of usedFonts) {
      const a = assets.find((a) => a.id === fid);
      if (!a) throw Error("ERR_FONT_MISSING");
      const b = await getBlob(a.blobKey);
      if (!b) throw Error("ERR_FONT_MISSING");
      await loadFont(a, b);
    }
    await document.fonts.ready;
    for (const n of resolved.layers.filter((n) => n.visible))
      for (const slot of n.slots) {
        if (!slot.assetId) throw Error("ERR_ASSET_MISSING");
        if (imageMap.has(slot.assetId)) continue;
        const a = assets.find((a) => a.id === slot.assetId);
        if (!a) throw Error("ERR_ASSET_MISSING");
        const blob = await getBlob(a.blobKey);
        if (!blob) throw Error("ERR_ASSET_MISSING");
        imageMap.set(a.id, this.texture(await loadImage(blob)));
      }
    if (!profile.transparent)
      this.app.stage.addChild(
        new Graphics()
          .rect(0, 0, profile.width, profile.height)
          .fill(profile.background),
      );
    const buildGroup = (parentId: string, parent: Container) => {
      for (const n of resolved.layers.filter(
        (n) => n.parentId === parentId && n.visible,
      )) {
        const box = resolved.boxes[n.id];
        let { x, y } = box;
        const { width: w, height: h } = box;
        if (parentId) {
          const pb = resolved.boxes[parentId];
          x -= pb.x;
          y -= pb.y;
        }
        if (n.type === "adjustment") {
          const target = n.adjustmentTarget
            ? parent.children.find((c) => c.label === n.adjustmentTarget)
            : undefined;
          if (n.adjustmentTarget && !target) throw Error("ERR_FX_TARGET");
          const wrapper = new Container();
          wrapper.label = n.id;
          if (target) {
            const index = parent.getChildIndex(target);
            parent.removeChild(target);
            wrapper.addChild(target);
            parent.addChildAt(wrapper, index);
          } else {
            const lower = parent.removeChildren();
            wrapper.addChild(...lower);
            parent.addChild(wrapper);
          }
          wrapper.filters = this.fx(n.effects);
          wrapper.filterArea = new Rectangle(
            0,
            0,
            profile.width,
            profile.height,
          );
          this.report.passes.push(
            `adjustment:${n.id}:scope=${parentId || "root"}`,
          );
          continue;
        }
        const outer = new Container();
        outer.label = n.id;
        outer.position.set(x + w / 2, y + h / 2);
        outer.pivot.set(w / 2, h / 2);
        outer.rotation = (n.rotation * Math.PI) / 180;
        outer.alpha = n.opacity;
        outer.blendMode = n.blend;
        parent.addChild(outer);
        const content = new Container();
        outer.addChild(content);
        if (n.type === "group") buildGroup(n.id, content);
        else if (n.type === "gradient")
          content.addChild(new Sprite(this.texture(this.gradient(n, w, h))));
        else if (n.type === "text" || n.type === "label")
          content.addChild(
            new Sprite(this.texture(this.textCanvas(n, w, h, p, profile))),
          );
        else if (n.type === "image" || n.type === "split") {
          const cells =
            n.type === "split"
              ? splitCells(w, h, n.lines)
              : [{ id: "root", polygon: rect(w, h) }];
          for (let ci = 0; ci < cells.length; ci++) {
            const cell = cells[ci],
              slot =
                n.slots.find((s) => s.id === n.cellOwners[cell.id]) ??
                n.slots[ci % n.slots.length];
            if (!slot) continue;
            const texture = imageMap.get(slot.assetId);
            if (!texture) throw Error("ERR_ASSET_MISSING");
            const clipped = new Container(),
              image = new Sprite(texture);
            const s =
              (slot.fit === "cover"
                ? Math.max(w / texture.width, h / texture.height)
                : Math.min(w / texture.width, h / texture.height)) *
              slot.placement.scale;
            image.scale.set(s);
            image.anchor.set(...slot.placement.pivot);
            image.position.set(slot.placement.x * w, slot.placement.y * h);
            image.rotation = (slot.placement.rotation * Math.PI) / 180;
            if (stageLimit !== "source") image.filters = this.fx(slot.effects);
            clipped.addChild(image);
            if (!["source", "imageFX"].includes(stageLimit)) {
              const mask = this.polygon(cell.polygon);
              clipped.addChild(mask);
              image.mask = mask;
            }
            content.addChild(clipped);
            this.report.passes.push(
              `slot:${slot.id}:source→FX→clip:${cell.id}`,
            );
          }
          if (!["source", "imageFX", "clip"].includes(stageLimit))
            for (const line of n.lines.filter(
              (l) => l.enabled && l.decorative,
            )) {
              const a: Point = [line.position[0] * w, line.position[1] * h],
                r = (line.angle * Math.PI) / 180,
                b: Point = [a[0] + Math.cos(r), a[1] + Math.sin(r)];
              const poly = clipHalf(rect(w, h), a, b);
              const points = poly.filter(
                (p) =>
                  Math.abs(
                    (b[0] - a[0]) * (p[1] - a[1]) -
                      (b[1] - a[1]) * (p[0] - a[0]),
                  ) < 0.01,
              );
              if (points.length >= 2)
                content.addChild(
                  new Graphics()
                    .moveTo(...points[0])
                    .lineTo(...points[1])
                    .stroke({
                      color: line.color,
                      width: line.width,
                      alpha: line.opacity,
                    }),
                );
            }
          this.report.passes.push("decoration");
        } else if (n.type === "particles") {
          const g = new Graphics();
          for (const pt of particles(n.particle, w, h)) {
            if (n.particle.kind === "polygon" || n.particle.kind === "spark")
              g.star(pt.x, pt.y, 4, pt.size, pt.size / 3, pt.rotation);
            else if (n.particle.kind === "petal")
              g.ellipse(pt.x, pt.y, pt.size, pt.size * 0.45);
            else g.circle(pt.x, pt.y, pt.size);
            g.fill({ color: n.particle.color, alpha: pt.alpha });
          }
          content.addChild(g);
        } else if (n.type === "icon") {
          const g = new Graphics(),
            size = Math.min(w, h) * 0.45;
          if (n.icon === "star" || n.icon === "sparkles")
            g.star(w / 2, h / 2, n.icon === "star" ? 5 : 4, size, size * 0.4);
          else if (n.icon === "diamond")
            g.poly([w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]);
          else if (n.icon === "heart") {
            g.moveTo(w / 2, h * 0.9)
              .bezierCurveTo(
                -w * 0.5,
                h * 0.2,
                w * 0.3,
                -h * 0.3,
                w / 2,
                h * 0.25,
              )
              .bezierCurveTo(
                w * 0.7,
                -h * 0.3,
                w * 1.5,
                h * 0.2,
                w / 2,
                h * 0.9,
              );
          } else if (n.icon === "moon") {
            g.circle(w / 2, h / 2, size);
            g.circle(w * 0.65, h * 0.35, size * 0.8).cut();
          } else if (n.icon === "flower") {
            for (let i = 0; i < 6; i++)
              g.circle(
                w / 2 + Math.cos((i * Math.PI) / 3) * size * 0.5,
                h / 2 + Math.sin((i * Math.PI) / 3) * size * 0.5,
                size * 0.45,
              );
          } else if (n.icon === "check")
            g.moveTo(w * 0.2, h * 0.5)
              .lineTo(w * 0.45, h * 0.8)
              .lineTo(w * 0.85, h * 0.2)
              .stroke({ width: size * 0.15, color: n.fill });
          else g.circle(w / 2, h / 2, size);
          g.fill(n.fill);
          content.addChild(g);
        } else content.addChild(this.shape(n, w, h).fill(n.fill));
        if (n.decoration !== "none") {
          const g = new Graphics(),
            random = seeded(12);
          if (n.decoration === "paper" || n.decoration === "torn") {
            for (let i = 0; i < 250; i++)
              g.circle(random() * w, random() * h, random() * 2).fill({
                color: 0x4b4032,
                alpha: 0.1,
              });
            if (n.decoration === "torn") {
              const pts: number[] = [0, 0, w, 0, w, h];
              for (let i = 20; i >= 0; i--)
                pts.push((w * i) / 20, h - 8 - random() * 18);
              pts.push(0, h);
              g.poly(pts).fill({ color: n.fill, alpha: 0.3 });
            }
          } else if (n.decoration === "plastic")
            g.poly([0, 0, w * 0.5, 0, w, h * 0.7, w, h, 0, h * 0.3]).fill({
              color: 0xffffff,
              alpha: 0.2,
            });
          else g.rect(0, 0, w, h).fill({ color: 0xf5d895, alpha: 0.3 });
          content.addChild(g);
        }
        if (n.mask !== "none") {
          const mask = this.shape(n, w, h).fill(0xffffff);
          outer.addChild(mask);
          content.mask = mask;
        }
        if (stageLimit === "final") outer.filters = this.fx(n.effects);
        this.report.passes.push(`node:${n.id}:${n.type}`);
      }
    };
    buildGroup("", this.app.stage);
    this.app.render();
    this.report.ms = performance.now() - start;
    this.report.textures = this.textures.length;
    this.report.estimatedBytes += this.textures.reduce(
      (s, t) => s + t.width * t.height * 4,
      0,
    );
    this.report.warnings = resolved.warnings;
    return { resolved, report: this.report };
  }
  async png(): Promise<Blob> {
    if (this.lost) throw Error("ERR_WEBGL_CONTEXT_LOST");
    this.app.render();
    const canvas = this.app.renderer.extract.canvas({
      target: this.app.stage,
      frame: new Rectangle(
        0,
        0,
        this.app.renderer.width,
        this.app.renderer.height,
      ),
      resolution: 1,
    }) as HTMLCanvasElement;
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(Error("ERR_PNG_ENCODE"))),
        "image/png",
      ),
    );
  }
}
