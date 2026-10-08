import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

/** A password box with a button at its end that shows or hides what has been typed. */
export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false)
  return (
    <span className="pwfield">
      <input {...props} type={shown ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" className="icon-btn" aria-label="Show the password" aria-pressed={shown} title={shown ? 'Hide the password' : 'Show the password'} onClick={() => setShown(!shown)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  )
}
