import React from 'react'

export default function GlitchText({ text, className = '', style = {}, tag: Tag = 'span' }) {
  return (
    <Tag
      className={`glitch-text ${className}`}
      data-text={text}
      style={{ fontFamily: 'var(--font-mono)', ...style }}
    >
      {text}
    </Tag>
  )
}
