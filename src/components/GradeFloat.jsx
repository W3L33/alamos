export default function GradeFloat({ grade, onChange }) {
  return (
    <nav className="grade-float" aria-label="Seleccionar grado">
      {[1, 2, 3].map((g) => (
        <button
          key={g}
          type="button"
          className={`grade-float__btn glass-pill ${grade === g ? "is-active" : ""}`}
          onClick={() => onChange(g)}
        >
          <span className="grade-float__label">{g}º</span>
        </button>
      ))}
    </nav>
  );
}
