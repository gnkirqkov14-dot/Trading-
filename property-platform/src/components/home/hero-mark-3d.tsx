"use client";

import { useEffect, useRef } from "react";
import type { Material } from "three";

const NAVY = 0x1a5180;
const MINT = 0x2bb98c;

/**
 * Знакът от логото, построен наново в 3D.
 *
 * Геометрията е **същата като в SVG-то** (`components/logo.tsx`), само
 * прехвърлена в координатите на three.js: там Y расте надолу, тук нагоре,
 * затова всяка точка минава през `y → 47 - y`, а после цялото се смалява
 * с `SCALE`. Затова 3D знакът не може да се разминава с плоския — при
 * промяна на логото се пипат и двете места.
 *
 * Не използваме готов 3D файл (GLB) нарочно: такъв тежи мегабайти, а
 * тази геометрия е няколко килобайта код и излиза остра на всеки екран.
 * Самият three.js се зарежда **динамично след hydration** — не влиза в
 * основния бъндъл и не бави първото рисуване на страницата.
 */
const SCALE = 1 / 20;
const toX = (x: number) => (x - 41) * SCALE;
const toY = (y: number) => (47 - y) * SCALE;

export function HeroMark3D({
  className,
  /**
   * Знакът като малко копче (плаващият помощник), а не като герой на
   * секцията: винаги олекотено качество — на 4-5 рем на екрана скъпият
   * материал не се вижда, а платката работи два пъти.
   */
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Хората, които са заявили "по-малко движение" в системата си, получават
    // статична картинка — анимацията не тръгва изобщо.
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Телефонът получава същия знак, но олекотен: без bevel, с по-груба
    // геометрия, по-евтин материал и половин резолюция. На малък екран
    // разликата почти не се вижда, а сметката за процесора е чувствително
    // по-малка — а точно оттам идват хората от социалните мрежи.
    const small = !window.matchMedia("(min-width: 1024px)").matches;
    const lite = small || compact;
    // Курсорът се следи само там, където изобщо има курсор.
    const followPointer = !small;

    let disposed = false;
    let booted = false;
    let cleanup = () => {};

    async function boot() {
      if (booted || disposed) return;
      const element = hostRef.current;
      if (!element) return;
      booted = true;

      const THREE = await import("three");
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 11);

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.5 : 2));
      renderer.setClearAlpha(0);
      element.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const group = new THREE.Group();
      scene.add(group);

      const navyMaterial = lite
        ? new THREE.MeshStandardMaterial({
            color: NAVY,
            roughness: 0.34,
            metalness: 0.14,
          })
        : new THREE.MeshPhysicalMaterial({
            color: NAVY,
            roughness: 0.28,
            metalness: 0.12,
            clearcoat: 1,
            clearcoatRoughness: 0.18,
          });

      const extrude = lite
        ? { depth: 0.52, bevelEnabled: false, curveSegments: 10 }
        : {
            depth: 0.52,
            bevelEnabled: true,
            bevelSize: 0.05,
            bevelThickness: 0.05,
            bevelSegments: 4,
            curveSegments: 24,
          };

      // --- Карфицата: контурът от SVG-то, с кръгъл отвор в средата ---
      const pin = new THREE.Shape();
      pin.moveTo(toX(41), toY(29));
      pin.bezierCurveTo(toX(54.25), toY(29), toX(65), toY(39.75), toX(65), toY(53));
      pin.bezierCurveTo(toX(65), toY(66.5), toX(51.5), toY(75), toX(41), toY(88));
      pin.bezierCurveTo(toX(30.5), toY(75), toX(17), toY(66.5), toX(17), toY(53));
      pin.bezierCurveTo(toX(17), toY(39.75), toX(27.75), toY(29), toX(41), toY(29));
      const hole = new THREE.Path();
      hole.absarc(toX(41), toY(53), 13.5 * SCALE, 0, Math.PI * 2, true);
      pin.holes.push(hole);
      group.add(new THREE.Mesh(new THREE.ExtrudeGeometry(pin, extrude), navyMaterial));

      // --- Покривът: две рамена под 45°, вместо дебела линия ---
      const armLength = Math.hypot(35, 35) * SCALE;
      const armGeometry = new THREE.BoxGeometry(armLength + 8.5 * SCALE, 8.5 * SCALE, extrude.depth);
      for (const sign of [-1, 1]) {
        const arm = new THREE.Mesh(armGeometry, navyMaterial);
        arm.position.set(sign * 17.5 * SCALE, toY(23.5), 0);
        arm.rotation.z = sign * -Math.PI / 4;
        group.add(arm);
      }

      // --- Коминът ---
      const chimney = new THREE.Mesh(
        new THREE.BoxGeometry(12 * SCALE, 15 * SCALE, extrude.depth),
        navyMaterial,
      );
      chimney.position.set(19.5 * SCALE, toY(18.5), 0);
      group.add(chimney);

      // --- Зелената точка: топка, която леко свети ---
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(8.5 * SCALE, lite ? 20 : 48, lite ? 14 : 32),
        lite
          ? new THREE.MeshStandardMaterial({
              color: MINT,
              roughness: 0.22,
              emissive: MINT,
              emissiveIntensity: 0.28,
            })
          : new THREE.MeshPhysicalMaterial({
              color: MINT,
              roughness: 0.15,
              metalness: 0.05,
              clearcoat: 1,
              emissive: MINT,
              emissiveIntensity: 0.28,
            }),
      );
      dot.position.set(toX(41), toY(53), extrude.depth / 2);
      group.add(dot);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb6c9, 2.1));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(4, 6, 8);
      scene.add(key);
      if (!lite) {
        const rim = new THREE.DirectionalLight(0x8fd9c0, 1.5);
        rim.position.set(-6, -2, 4);
        scene.add(rim);
      }

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = element;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(element);

      // Целите се движат плавно към стойностите от мишката/скрола, вместо
      // да скачат — иначе движението е накъсано и евтино на вид.
      const target = { x: 0, y: 0 };
      function onPointerMove(event: PointerEvent) {
        target.y = (event.clientX / window.innerWidth - 0.5) * 1.1;
        target.x = (event.clientY / window.innerHeight - 0.5) * 0.7;
      }
      if (followPointer) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
      }

      let scrollSpin = 0;
      function onScroll() {
        scrollSpin = window.scrollY * 0.0016;
      }
      window.addEventListener("scroll", onScroll, { passive: true });

      // Не рисуваме, докато знакът не е на екрана — иначе върти
      // вентилатора на лаптопа за нищо.
      let visible = true;
      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
        },
        { threshold: 0 },
      );
      intersectionObserver.observe(element);

      let frame = 0;
      const startedAt = performance.now();
      function tick() {
        frame = requestAnimationFrame(tick);
        if (!visible) return;
        const seconds = (performance.now() - startedAt) / 1000;
        group.rotation.y += (target.y + scrollSpin - group.rotation.y) * 0.06;
        group.rotation.x += (target.x - group.rotation.x) * 0.06;
        group.position.y = Math.sin(seconds * 0.9) * (compact ? 0.07 : 0.12);
        renderer.render(scene, camera);
      }

      if (calm) {
        renderer.render(scene, camera);
      } else {
        tick();
      }

      cleanup = () => {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        if (followPointer) window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("scroll", onScroll);
        renderer.domElement.remove();
        renderer.dispose();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const material = object.material as Material | Material[];
            if (Array.isArray(material)) material.forEach((m) => m.dispose());
            else material.dispose();
          }
        });
      };
    }

    void boot();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [compact]);

  // Плаващият помощник (`components/assistant/ai-assistant.tsx`) търси
  // точно този атрибут, за да разбере кога голямата картина в началото е
  // излязла от екрана — чак тогава показва своето копче. Същият атрибут
  // носи и скрол сцената (`story-scroll.tsx`).
  return (
    <div
      ref={hostRef}
      aria-hidden
      data-hero-scene={compact ? undefined : ""}
      className={className}
    />
  );
}
