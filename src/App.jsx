import { useCallback, useEffect, useState } from 'react'
import sameDifferentSignUrl from './assets/signs/same-different.png?url'
import bigSmallSignUrl from './assets/signs/big-small.png?url'
import inOutSignUrl from './assets/signs/in-out.png?url'
import upDownSignUrl from './assets/signs/up-down.png?url'
import giveTakeSignUrl from './assets/signs/give-take.png?url'
import stopGoSignUrl from './assets/signs/stop-go.png?url'
import moreSignUrl from './assets/signs/more.png?url'
import finishSignUrl from './assets/signs/finish.png?url'
import lookSignUrl from './assets/signs/look.png?url'

/** Each option is one selectable concept (pairs are a single choice). */
const CONCEPTS = [
  'SAME and DIFFERENT',
  'BIG and SMALL',
  'IN and OUT',
  'UP and DOWN',
  'GIVE and TAKE',
  'STOP and GO',
  'MORE',
  'FINISH',
  'LOOK',
]

/** Older builds stored a single word (e.g. BIG); map to the new pair label. */
const LEGACY_CONCEPT_TO_CURRENT = {
  SAME: 'SAME and DIFFERENT',
  DIFFERENT: 'SAME and DIFFERENT',
  BIG: 'BIG and SMALL',
  SMALL: 'BIG and SMALL',
  IN: 'IN and OUT',
  OUT: 'IN and OUT',
  UP: 'UP and DOWN',
  DOWN: 'UP and DOWN',
  GIVE: 'GIVE and TAKE',
  TAKE: 'GIVE and TAKE',
  STOP: 'STOP and GO',
  GO: 'STOP and GO',
  MORE: 'MORE',
  FINISH: 'FINISH',
  LOOK: 'LOOK',
}

function normalizeStoredConcept(raw) {
  if (!raw || typeof raw !== 'string') return null
  if (CONCEPTS.includes(raw)) return raw
  return LEGACY_CONCEPT_TO_CURRENT[raw] ?? null
}

/** Avoid a lone email in Student notes (browser autofill, password managers, mistaken save). */
function isLoneEmailString(value) {
  if (typeof value !== 'string') return false
  const t = value.replace(/\u200B/g, '').trim()
  if (t === '') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

function sanitizeStoredStudentNotes(value) {
  if (typeof value !== 'string') return ''
  return isLoneEmailString(value) ? '' : value
}

const STORAGE_KEY = 'zl_script_builder_v1'

/** Strict output skeleton the model must follow */
const OUTPUT_TEMPLATE = `CONCEPT:
LANGUAGE TARGET:

SETUP:

SCRIPT (10–15 numbered steps minimum):

EXPECTED STUDENT RESPONSES:

IF STUDENT RESPONDS:

IF STUDENT DOES NOT RESPOND:

REPETITION PLAN (must reach 10–20 cycles):

COMMON MISTAKES TO AVOID:`

/** Binding order for the model (highest first). Reflected in prompt structure. */
const PROMPT_AUTHORITY_HIERARCHY = `AUTHORITY ORDER (BINDING — highest first)
1. Safety / policy (e.g. safeguarding, contraindications for physical guidance stated by the expert)
2. Locked concept doctrine (what this concept means for zero-language teaching — embodied in CONCEPT TYPE RULES and primary concept below)
3. Concept-specific non-negotiables (TYPE rules, modality rules, repetition structure, template)
4. Teaching frame (TYPE 1 vs 2 vs 3 for this concept — do not mix frames)
5. Expert teaching constraints (TEACHER COMMENTS block below — high authority for tailoring)
6. Student notes (child-specific facts — lower than expert constraints)
7. Materials (use or adapt — must still serve the concept and frame)

If expert constraints conflict with 1–4, preserve 1–4 and adapt the rest to honour the expert’s underlying intent as far as possible. Expert constraints never redefine which concept is being taught.`

/** Embedded in the generator prompt. */
const PROMPT_GENERATOR_TEACHER_COMMENTS_RULES = `TEACHER COMMENTS PRIORITY RULE
Teacher comments are high-authority expert guidance from a qualified Teacher of the Deaf.
Treat them as binding instructional constraints unless they conflict with concept doctrine, concept-specific non-negotiables, teaching frame, or safety.

Use teacher comments to:
- tailor the script to the student
- avoid known failed approaches
- reflect the expert's teaching goal
- respect cautions and tolerances
- honour student-specific success markers where compatible with doctrine

Do NOT:
- treat teacher comments as casual flavour text
- let teacher comments change the concept being taught
- let teacher comments push the script into the wrong teaching frame

If a teacher comment conflicts with doctrine, frame, or safety:
- preserve doctrine/frame/safety
- adapt the script to honour the teacher's underlying intent as far as possible`

/** Ready for a future evaluator API call (not wired yet). */
const PROMPT_EVALUATOR_TEACHER_COMMENTS_CHECK = `TEACHER COMMENTS — EVALUATION CHECK (MANDATORY)
The script was generated with access to expert teaching constraints. Assess:
- Did the script honour those constraints where compatible with doctrine and frame?
- Did it ignore a clearly stated expert constraint that was possible within doctrine?
- Did it follow a constraint in a way that broke the concept or teaching frame?
- Did it treat expert constraints as optional flavour text?
Do not treat student notes and expert constraints as the same: expert constraints outrank student notes for instructional intent.`

/** Ready for a future rewrite API call (not wired yet). */
const PROMPT_REWRITE_TEACHER_OBLIGATIONS = `TEACHER COMMENTS — REWRITE OBLIGATIONS
When rewriting: fix evaluator failures; restore missed expert intent from the expert teaching constraints; do not preserve flawed structure or wording if it conflicts with doctrine, frame, or expert constraints.
Priority when in tension: doctrine / non-negotiables / frame > expert constraints (adapted) > student notes > materials.`

function buildPrompt(selectedConcept, materials, notes, expertTeachingConstraints, draftScriptToRevise) {
  const materialsLine = materials?.trim() || 'not specified'
  const notesLine = notes?.trim() || 'none'
  const expertBlock =
    expertTeachingConstraints?.trim().length > 0
      ? expertTeachingConstraints.trim()
      : '(none provided)'
  const fixBlock =
    draftScriptToRevise?.trim().length > 0
      ? `

MODE: REWRITE (fix completely)
A draft micro-script is provided below for you to revise or replace entirely. Rewrite from scratch to meet every rule below. Replace vague actions with exact movements. Remove anything that assumes comprehension. Align with CONCEPT TYPE RULES; add contrast only where TYPE 1 applies. Increase repetition and intensity.
Expert teaching constraints (if any) appear in the TEACHER COMMENTS block — they are not the same as this draft; apply both.

DRAFT SCRIPT (verbatim):

${draftScriptToRevise.trim()}
`
      : `

MODE: NEW SCRIPT
Create a new teaching micro-script from scratch.
`

  return `You are an elite teacher of the deaf specialising in students with ZERO language (no understanding of words, instructions, or concepts).

${fixBlock}

${PROMPT_AUTHORITY_HIERARCHY}

NON-NEGOTIABLE RULES
The student has ZERO language: assume no comprehension of words, signs as symbols, or instructions.
Teaching must be through ACTION and CONTINGENT MODELLING, not explanation.

Primary concept for this script: ${selectedConcept}

CONCEPT TYPE RULES (CRITICAL)

You must first classify the concept above into exactly one TYPE using the lists below, then design the script accordingly.

TYPE 1 — CONTRAST CONCEPTS
(SAME and DIFFERENT, BIG and SMALL, MORE)
→ MUST include contrast
→ Use grouping, separating, comparing
→ For SAME and DIFFERENT and for BIG and SMALL, both sides of the contrast must appear in the setup and script.

TYPE 2 — ATTENTION / ACTION CONCEPTS
(LOOK, STOP and GO)
→ NO object sorting or grouping
→ Focus on controlling the student's attention or action
→ Use movement, face, gesture
→ Example: gain eye gaze, pause movement, restart action

TYPE 3 — ROUTINE / FUNCTIONAL CONCEPTS
(FINISH, GIVE and TAKE, IN and OUT, UP and DOWN)
→ Must be embedded in a real action sequence
→ Show clear BEFORE → ACTION → END
→ The word/sign marks a moment in time, not an object

DESIGN RULE
Do NOT apply contrast unless it is a TYPE 1 concept.
Match the teaching method to the concept type.
If mismatch → rewrite the script.

${PROMPT_GENERATOR_TEACHER_COMMENTS_RULES}

Expert teaching constraints (verbatim):
${expertBlock}

Student notes (lower authority than expert constraints): ${notesLine}

Materials (use or adapt within doctrine and frame): ${materialsLine}

Use ONLY 1–2 language targets (signs/labels in the LANGUAGE TARGET line only; steps describe observable behaviour).
No questions to the student.
Do not use vague wording such as: encourage, help, support, prompt, remind, let the student try, figure out, understand, knows, realizes, means.
Every step must name exact observable movements: who moves what, where on the table, how many times, how many seconds.
A teacher aide with minimal training must be able to follow exactly.
Minimum 10–15 repetitions of the target modelling sequence within the SCRIPT (counted as separate numbered steps or explicit repeat blocks).
Include hand-over-hand guidance steps when there is no response (policy permitting).

REQUIRED IMPROVEMENTS (must appear in the script content, matched to the concept TYPE)
TYPE 1: clear contrast via grouping, separating, or comparing; exaggerated repeated modelling of sign plus mapped action.
TYPE 2: attention and action control only—no object-sorting tasks; strong face, body, movement, gesture; repeated modelling.
TYPE 3: a believable routine with BEFORE → ACTION → END; the sign marks a clear moment in the sequence; repeated modelling within that sequence.
All types: no reliance on the student understanding labels; learning is from repeated pairing of action and model.

Output format: plain text only. No markdown. No asterisks, bold, italics.

Language modality: do not instruct the aide to rely on the student hearing speech. Use: sign, model the sign, produce the sign, show the sign, exaggerate the sign, repeat the sign, with clear face and body. Optional mouthing may be noted as secondary only.

FINAL VALIDATION (MANDATORY)

Before output, check:

Does the action MATCH the concept?
Would a student learn the meaning through action alone?
Is this how the concept appears in real life?

If not → rewrite.

Follow this exact format (headings and order):

${OUTPUT_TEMPLATE}`
}

/** Plain text only: remove markdown asterisks the model sometimes adds */
function stripAsterisks(text) {
  return text.replace(/\*+/g, '')
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Illustrative signs: contrast pairs (combined PNG) or a single concept image. */
const SIGN_PAIR = {
  'same-different': {
    url: sameDifferentSignUrl,
    heading: 'SAME · DIFFERENT',
    alt: 'SAME and DIFFERENT signs',
  },
  'big-small': {
    url: bigSmallSignUrl,
    heading: 'BIG · SMALL',
    alt: 'BIG and SMALL signs',
  },
  'in-out': {
    url: inOutSignUrl,
    heading: 'IN · OUT',
    alt: 'IN and OUT signs',
  },
  'up-down': {
    url: upDownSignUrl,
    heading: 'UP · DOWN',
    alt: 'UP and DOWN signs',
  },
  'give-take': {
    url: giveTakeSignUrl,
    heading: 'GIVE · TAKE',
    alt: 'GIVE and TAKE signs',
  },
  'stop-go': {
    url: stopGoSignUrl,
    heading: 'STOP · GO',
    alt: 'STOP and GO signs',
  },
  more: {
    url: moreSignUrl,
    heading: 'MORE',
    alt: 'MORE sign',
  },
  finish: {
    url: finishSignUrl,
    heading: 'FINISH',
    alt: 'FINISH sign',
  },
  look: {
    url: lookSignUrl,
    heading: 'LOOK',
    alt: 'LOOK sign',
  },
}

function getSignPairForConcept(concept) {
  if (concept === 'SAME and DIFFERENT') return SIGN_PAIR['same-different']
  if (concept === 'BIG and SMALL') return SIGN_PAIR['big-small']
  if (concept === 'IN and OUT') return SIGN_PAIR['in-out']
  if (concept === 'UP and DOWN') return SIGN_PAIR['up-down']
  if (concept === 'GIVE and TAKE') return SIGN_PAIR['give-take']
  if (concept === 'STOP and GO') return SIGN_PAIR['stop-go']
  if (concept === 'MORE') return SIGN_PAIR.more
  if (concept === 'FINISH') return SIGN_PAIR.finish
  if (concept === 'LOOK') return SIGN_PAIR.look
  return null
}

/** Opens the default mail app without navigating the page away (avoids losing the app tab). */
function openMailto(mailtoHref) {
  const a = document.createElement('a')
  a.href = mailtoHref
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Same payload as Copy: rich HTML + image when a sign pair applies; plain text otherwise. */
async function writeScriptClipboard(text, concept) {
  const pair = getSignPairForConcept(concept)
  if (pair && typeof ClipboardItem !== 'undefined') {
    try {
      const res = await fetch(pair.url)
      const blob = await res.blob()
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onloadend = () => resolve(r.result)
        r.onerror = () => reject(new Error('read'))
        r.readAsDataURL(blob)
      })
      const html = `<!DOCTYPE html><html><body><div style="margin-bottom:16px"><p style="font-weight:600;margin:0 0 8px 0;font-family:system-ui,sans-serif;font-size:14px">${escapeHtml(
        pair.heading,
      )}</p><img src="${dataUrl}" alt="${escapeHtml(pair.alt)}" style="max-width:100%;height:auto;display:block" /></div><pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;margin:0">${escapeHtml(
        text,
      )}</pre></body></html>`
      const plain = `${pair.heading}\n\n${text}`
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
      return true
    } catch {
      /* fall through */
    }
  }
  try {
    await navigator.clipboard.writeText(pair ? `${pair.heading}\n\n${text}` : text)
    return true
  } catch {
    return false
  }
}

function SignReferenceStrip({ activeConcept }) {
  const pair = getSignPairForConcept(activeConcept)
  if (!pair) return null

  return (
    <div className="no-print rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="mb-1 text-base font-medium text-slate-800">{pair.heading}</p>
      <p className="mb-3 text-sm text-slate-600">
        Illustrative only—signs differ by region; confirm with your Deaf mentor or team.
      </p>
      <figure className="overflow-hidden rounded-xl border-2 border-teal-600/40 bg-white shadow-sm ring-2 ring-teal-600/15">
        <img
          src={pair.url}
          alt={pair.alt}
          className="h-auto w-full max-h-[min(70vh,520px)] object-contain"
          loading="lazy"
          decoding="async"
        />
      </figure>
      <p className="mt-3 text-xs text-slate-500">
        Concept: <span className="font-semibold text-slate-700">{activeConcept}</span>
      </p>
    </div>
  )
}

async function callOpenAI(apiKey, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText || 'Request failed'
    throw new Error(msg)
  }

  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') {
    throw new Error('No text in response')
  }
  return stripAsterisks(text).trim()
}

export default function App() {
  const [concept, setConcept] = useState(CONCEPTS[0])
  const [materials, setMaterials] = useState('')
  const [notes, setNotes] = useState('')
  const [expertTeachingConstraints, setExpertTeachingConstraints] = useState('')
  const [draftScriptToRevise, setDraftScriptToRevise] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  /** Stops Chrome/Safari from injecting email into this field before first focus. */
  const [studentNotesReadOnly, setStudentNotesReadOnly] = useState(true)

  const envKey = import.meta.env.VITE_OPENAI_API_KEY || ''
  const effectiveKey = apiKey.trim() || envKey

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      const normalized = normalizeStoredConcept(parsed.concept)
      if (normalized) setConcept(normalized)
      if (typeof parsed.materials === 'string') setMaterials(parsed.materials)
      if (typeof parsed.notes === 'string') {
        const cleaned = sanitizeStoredStudentNotes(parsed.notes)
        setNotes(cleaned)
        if (cleaned !== parsed.notes) {
          parsed.notes = cleaned
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ ...parsed, savedAt: new Date().toISOString() }),
            )
          } catch {
            /* ignore */
          }
        }
      }
      if (typeof parsed.expertTeachingConstraints === 'string') {
        setExpertTeachingConstraints(parsed.expertTeachingConstraints)
      } else if (typeof parsed.scriptToFix === 'string') {
        setExpertTeachingConstraints(parsed.scriptToFix)
      }
      if (typeof parsed.draftScriptToRevise === 'string') setDraftScriptToRevise(parsed.draftScriptToRevise)
      if (typeof parsed.lastOutput === 'string') setOutput(stripAsterisks(parsed.lastOutput))
    } catch {
      /* ignore */
    }
  }, [])

  /** Browsers often autofill after paint — strip a lone email for a short window. */
  useEffect(() => {
    const clearIfLoneEmail = () => {
      setNotes((prev) => (isLoneEmailString(prev) ? '' : prev))
    }
    const timeouts = [0, 50, 100, 250, 500, 1000, 2000].map((ms) => setTimeout(clearIfLoneEmail, ms))
    return () => timeouts.forEach(clearTimeout)
  }, [])

  const persist = useCallback((next) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          concept: next.concept ?? concept,
          materials: next.materials ?? materials,
          notes: next.notes ?? notes,
          expertTeachingConstraints: next.expertTeachingConstraints ?? expertTeachingConstraints,
          draftScriptToRevise: next.draftScriptToRevise ?? draftScriptToRevise,
          lastOutput: next.lastOutput ?? output,
          savedAt: new Date().toISOString(),
        }),
      )
    } catch {
      /* ignore */
    }
  }, [concept, materials, notes, expertTeachingConstraints, draftScriptToRevise, output])

  const generate = useCallback(async () => {
    setError('')
    setCopied(false)
    if (!effectiveKey) {
      setError('Add your OpenAI API key below, or set VITE_OPENAI_API_KEY in a .env file.')
      return
    }
    setLoading(true)
    setOutput('')
    try {
      const prompt = buildPrompt(concept, materials, notes, expertTeachingConstraints, draftScriptToRevise)
      const text = await callOpenAI(effectiveKey, prompt)
      setOutput(text)
      persist({
        concept,
        materials,
        notes,
        expertTeachingConstraints,
        draftScriptToRevise,
        lastOutput: text,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [concept, materials, notes, expertTeachingConstraints, draftScriptToRevise, effectiveKey, persist])

  const copyOutput = useCallback(async () => {
    if (!output) return
    const text = stripAsterisks(output)
    const ok = await writeScriptClipboard(text, concept)
    if (!ok) {
      setError('Could not copy. Select the text manually.')
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [output, concept])

  const handleEmail = useCallback(async () => {
    if (!output) return
    setError('')
    const text = stripAsterisks(output)
    const subject = `AUSPLAN Script — ${concept}`
    const subjectQ = encodeURIComponent(subject)

    if (getSignPairForConcept(concept)) {
      const ok = await writeScriptClipboard(text, concept)
      if (!ok) {
        setError('Could not prepare email. Try Copy, then paste into your mail app.')
        return
      }
      openMailto(`mailto:?subject=${subjectQ}`)
      return
    }

    const body = text
    const mailto = `mailto:?subject=${subjectQ}&body=${encodeURIComponent(body)}`
    const maxLen = 8000

    if (mailto.length <= maxLen) {
      openMailto(mailto)
      return
    }
    try {
      await navigator.clipboard.writeText(body)
      openMailto(
        `mailto:?subject=${subjectQ}&body=${encodeURIComponent(
          'The full script is in your clipboard.\n\nPaste it into the email body (Cmd+V or Ctrl+V).\n\n' +
            '(Your email program limits how much text can be put in the link automatically.)',
        )}`,
      )
    } catch {
      const truncated =
        body.length > 1200 ? `${body.slice(0, 1200)}\n\n[Truncated. Use Copy for the full script.]` : body
      openMailto(`mailto:?subject=${subjectQ}&body=${encodeURIComponent(truncated)}`)
    }
  }, [output, concept])

  const handlePrint = () => {
    window.print()
  }

  const signPair = getSignPairForConcept(concept)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white no-print">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            AUSPLAN Script Builder
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Instant micro-scripts for students with no spoken or signed language yet.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
        <form
          className="no-print space-y-6"
          autoComplete="off"
          name="ausplan-builder"
          onSubmit={(e) => e.preventDefault()}
        >
          {/* Honeypot fields: many browsers/extensions fill "email" / "password" into the first matching inputs. */}
          <div className="sr-only" aria-hidden="true">
            <input type="text" tabIndex={-1} name="decoy-email" autoComplete="nope" />
            <input type="password" tabIndex={-1} name="decoy-password" autoComplete="new-password" />
          </div>

          <div>
            <label htmlFor="concept" className="mb-2 block text-base font-medium text-slate-800">
              Concept
            </label>
            <select
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            >
              {CONCEPTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <SignReferenceStrip activeConcept={concept} />

          <div>
            <label htmlFor="materials" className="mb-2 block text-base font-medium text-slate-800">
              Materials
            </label>
            <input
              id="materials"
              name="ausplan-materials"
              type="text"
              autoComplete="off"
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div>
            <label htmlFor="student-notes" className="mb-2 block text-base font-medium text-slate-800">
              Student notes
            </label>
            <input
              id="student-notes"
              name="ausplanStudentNotes"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              readOnly={studentNotesReadOnly}
              data-lpignore="true"
              data-1p-ignore="true"
              value={notes}
              onFocus={() => setStudentNotesReadOnly(false)}
              onChange={(e) => {
                const v = e.target.value
                setNotes(isLoneEmailString(v) ? '' : v)
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
          </div>

          <div>
            <label htmlFor="expertTeachingConstraints" className="mb-2 block text-base font-medium text-slate-800">
              Expert teaching constraints
            </label>
            <textarea
              id="expertTeachingConstraints"
              rows={5}
              value={expertTeachingConstraints}
              onChange={(e) => setExpertTeachingConstraints(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
            <p className="mt-1.5 text-sm text-slate-500">
              High-priority expert guidance: known failures, cautions, success markers, and teaching intent.
            </p>
          </div>

          <div>
            <label htmlFor="draftScriptToRevise" className="mb-2 block text-base font-medium text-slate-800">
              Draft script to revise <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="draftScriptToRevise"
              rows={5}
              value={draftScriptToRevise}
              onChange={(e) => setDraftScriptToRevise(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
            <p className="mt-1.5 text-sm text-slate-500">
              Paste a flawed draft here only when you want full rewrite mode. Expert constraints above apply in both new and rewrite modes.
            </p>
          </div>

          <div>
            <label htmlFor="apikey" className="mb-2 block text-base font-medium text-slate-800">
              OpenAI API key <span className="font-normal text-slate-500">(if not in .env)</span>
            </label>
            <input
              id="apikey"
              name="ausplan-openai-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
            <p className="mt-1 text-sm text-slate-500">
              For local use only. Alternatively create <code className="rounded bg-slate-100 px-1">.env</code> with{' '}
              <code className="rounded bg-slate-100 px-1">VITE_OPENAI_API_KEY=…</code>
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="w-full rounded-xl bg-teal-700 px-8 py-4 text-xl font-semibold text-white shadow-md transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[240px]"
            >
              {loading ? 'Working…' : draftScriptToRevise.trim() ? 'Rewrite script' : 'Generate script'}
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={loading || !output}
              className="w-full rounded-xl border-2 border-slate-300 bg-white px-6 py-3 text-lg font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Regenerate
            </button>
          </div>

          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-900"
              role="alert"
            >
              {error}
            </div>
          )}
        </form>

        <section
          className={`mt-10 print-break ${output ? 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none' : 'no-print'}`}
          aria-live="polite"
        >
          {output ? (
            <>
              <div className="mb-4 hidden print:block print-break">
                <h2 className="text-xl font-bold text-slate-900">AUSPLAN Script</h2>
                <p className="text-sm text-slate-600">{new Date().toLocaleString()}</p>
              </div>
              {signPair && (
                <div className="mb-4 hidden print:block print-break">
                  <p className="mb-2 text-sm font-semibold text-slate-800">{signPair.heading}</p>
                  <img
                    src={signPair.url}
                    alt={signPair.alt}
                    className="max-h-80 w-auto max-w-full object-contain object-left"
                  />
                </div>
              )}
              {signPair && (
                <p className="no-print mb-3 text-sm text-slate-600">
                  Email opens your mail program and puts the same image + script on the clipboard as Copy. Click in the
                  message body and paste (Cmd+V or Ctrl+V) to add the sign image and script.
                </p>
              )}
              <div className="no-print mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyOutput}
                  title={
                    signPair
                      ? `Copies script with ${signPair.heading} image on top in Word, Google Docs, and most email apps`
                      : undefined
                  }
                  className="rounded-lg bg-slate-800 px-5 py-2.5 text-base font-medium text-white hover:bg-slate-900"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-800 hover:bg-slate-50"
                >
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleEmail}
                  title={
                    signPair
                      ? 'Opens your mail app; image and script are on the clipboard — paste into the message (Cmd+V or Ctrl+V)'
                      : 'Opens your default email app with the script in the message'
                  }
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-800 hover:bg-slate-50"
                >
                  Email
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-slate-900 print:text-base">
                {stripAsterisks(output)}
              </pre>
            </>
          ) : (
            !loading && (
              <p className="no-print text-center text-lg text-slate-500">
                Generated script will appear here.
              </p>
            )
          )}
          {loading && (
            <p className="text-center text-lg text-slate-600 no-print">Working…</p>
          )}
        </section>
      </main>

      <footer className="no-print mt-auto border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-3xl px-4 text-center text-sm text-slate-500">
          © 2026 All rights reserved Dr Dimity Comino
        </div>
      </footer>
    </div>
  )
}
