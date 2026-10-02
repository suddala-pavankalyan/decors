'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '@/components/Icon';
import {
  deleteImage, IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, reorderImages, uploadImage,
  type AdminImage, type AdminProduct,
} from '@/lib/admin';

export default function ImageManager({
  productId, images, onChange,
}: { productId: string; images: AdminImage[]; onChange: (p: AdminProduct) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    const errs: string[] = [];
    let count = images.length;
    setBusy(true);
    for (const [i, file] of files.entries()) {
      if (!IMAGE_TYPES.includes(file.type)) { errs.push(`${file.name}: only JPEG, PNG or WebP images are allowed.`); continue; }
      if (file.size > MAX_IMAGE_BYTES) { errs.push(`${file.name}: larger than 5 MB.`); continue; }
      if (count >= MAX_IMAGES) { errs.push(`${file.name}: a product can have at most ${MAX_IMAGES} photos.`); continue; }
      setStatus(`Uploading ${i + 1} of ${files.length}…`);
      try {
        onChange(await uploadImage(productId, file));
        count++;
      } catch (e) {
        errs.push(`${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`);
      }
    }
    setErrors(errs);
    setStatus('');
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  async function run(fn: () => Promise<AdminProduct>) {
    setBusy(true);
    setErrors([]);
    try {
      onChange(await fn());
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Something went wrong']);
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  const makeMain = (id: number) => run(() => reorderImages(productId, [id, ...images.map((i) => i.id).filter((x) => x !== id)]));

  return (
    <section aria-label="Photos" className="rounded-3xl bg-white/80 p-6 shadow-xl">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-bold">Photos</h2>
        <span className="text-sm text-slate-500">{images.length} of {MAX_IMAGES}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">The first photo is the main one shown in the catalog. JPEG, PNG or WebP, up to 5 MB each.</p>

      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        <AnimatePresence initial={false}>
          {images.map((img, i) => (
            <motion.li
              key={img.id} layout
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                <Image src={img.url} alt={img.alt} fill sizes="(min-width:768px) 20vw, 45vw" className="object-cover" />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-spectrum px-2.5 py-0.5 text-xs font-semibold text-white shadow">Main</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-2 text-xs">
                {i !== 0 ? (
                  <button type="button" disabled={busy} onClick={() => makeMain(img.id)}
                    className="rounded-full border border-slate-200 px-2.5 py-1 font-medium hover:border-fuchsia-300 disabled:opacity-50">
                    Make main
                  </button>
                ) : <span />}
                {confirming === img.id ? (
                  <span className="inline-flex items-center gap-1">
                    <button type="button" disabled={busy} onClick={() => run(() => deleteImage(productId, img.id))}
                      className="rounded-full bg-rose-600 px-2.5 py-1 font-semibold text-white disabled:opacity-60">Delete</button>
                    <button type="button" onClick={() => setConfirming(null)} className="rounded-full border border-slate-200 px-2.5 py-1">Keep</button>
                  </span>
                ) : (
                  <button type="button" disabled={busy} aria-label={`Delete photo ${i + 1}`} onClick={() => setConfirming(img.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {images.length < MAX_IMAGES && (
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) addFiles(e.dataTransfer.files); }}
          className={`mt-4 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
            over ? 'border-fuchsia-400 bg-fuchsia-50' : 'border-slate-300 bg-white/60'
          }`}
        >
          <Icon name="upload" size={28} className="text-fuchsia-600" />
          <p className="text-sm text-slate-600">Drag photos here, or</p>
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? status || 'Working…' : 'Choose photos'}
          </button>
          <input ref={input} type="file" multiple accept={IMAGE_TYPES.join(',')} className="sr-only" aria-label="Choose photos to upload"
            onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>
      )}

      <div aria-live="polite">
        {errors.length > 0 && (
          <ul role="alert" className="mt-3 space-y-1 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
