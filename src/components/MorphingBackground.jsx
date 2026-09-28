function MorphingBackground() {
  return (
    <div
      className="dtr-morphing-background"
      aria-hidden="true"
    >
      <svg
        className="dtr-morphing-filter"
        width="0"
        height="0"
        focusable="false"
      >
        <defs>
          <filter id="dtr-morphing-goo">
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="30"
              result="blur"
            />

            <feColorMatrix
              in="blur"
              mode="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 18 -8
              "
              result="goo"
            />

            <feBlend
              in="SourceGraphic"
              in2="goo"
            />
          </filter>
        </defs>
      </svg>

      <div className="dtr-morphing-field">
        <div className="dtr-morphing-blob dtr-morphing-blob-1" />
        <div className="dtr-morphing-blob dtr-morphing-blob-2" />
        <div className="dtr-morphing-blob dtr-morphing-blob-3" />
        <div className="dtr-morphing-blob dtr-morphing-blob-4" />
        <div className="dtr-morphing-blob dtr-morphing-blob-5" />
      </div>

      <div className="dtr-morphing-vignette" />
    </div>
  )
}

export default MorphingBackground
