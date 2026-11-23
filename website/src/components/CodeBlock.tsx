/** Static code block used on the landing page. Docs use the same markup via the markdown pipeline. */
export function CodeBlock({
  lang = "bash",
  lines,
  className = "",
}: {
  lang?: string;
  lines: Array<string | { prompt?: boolean; text: string; comment?: string }>;
  className?: string;
}) {
  return (
    <div className={`codeblock ${className}`}>
      <div className="codeblock-bar">
        <span>{lang}</span>
        <button type="button" className="copy-btn" aria-label="Copy to clipboard">
          Copy
        </button>
      </div>
      <pre>
        <code>
          {lines.map((l, i) => {
            const line = typeof l === "string" ? { text: l } : l;
            return (
              <span key={i} data-line="">
                {line.prompt ? <span style={{ color: "#5f6762" }}>$ </span> : null}
                <span>{line.text}</span>
                {line.comment ? <span style={{ color: "#6e7a72" }}>{"  "}# {line.comment}</span> : null}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
