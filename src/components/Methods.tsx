const papers = [
  [
    "Ettayan et al. (2025)",
    "Review on multi-material 3D printing via FDM",
    "10.5604/01.3001.0055.4326",
  ],
  [
    "Evans et al. (2025)",
    "Sustainable design approaches for thermoplastics in additive manufacturing",
    "10.1017/pds.2025.10311",
  ],
  [
    "Goh et al. (2024)",
    "Enhancing interlaminar adhesion in multi-material 3D printing",
    "10.36922/msam.2672",
  ],
  [
    "Frascio et al. (2024)",
    "Investigating enhanced interfacial adhesion: t and Mickey Mouse geometries",
    "10.1007/s40964-024-00570-8",
  ],
  [
    "Farràs-Tasias et al. (2026)",
    "Printing orientation and interfacial mechanical design enable superior bonding",
    "10.1038/s44334-026-00075-y",
  ],
  [
    "Birosz & Andó (2024)",
    "Effect of infill pattern scaling on mechanical properties of FDM-printed PLA specimens",
    "10.1007/s40964-023-00487-8",
  ],
  [
    "Aboelella et al. (2025)",
    "Layer combination of similar infill patterns on tensile and compression behaviour",
    "10.1038/s41598-025-94446-8",
  ],
  [
    "Gebrehiwot et al. (2023)",
    "Optimising the mechanical properties of additive-manufactured recycled PLA",
    "10.1007/s00170-023-12623-3",
  ],
  [
    "Meng X. et al. (2025)",
    "Adaptive Infill Method Based on Cross-Section Features and Transition-Layer Design [preprint]",
    "10.21203/rs.3.rs-7965413/v1",
  ],
  [
    "Meng Z. et al. (2025)",
    "Lace 3D printing for deployable mechanical metamaterials",
    "10.1080/17452759.2025.2590577",
  ],
  [
    "Brackett et al. (2026)",
    "Transition Behavior in Blended Material Large Format Additive Manufacturing",
    "10.3390/polym18020178",
  ],
];
export default function Methods() {
  return (
    <article className="methods">
      <div className="page-intro">
        <span className="eyebrow">MODEL NOTES / VERSION 1.0.0</span>
        <h2>What is being calculated?</h2>
        <p>
          A geometric allocation model for one shared-nozzle material switch.
          The model asks whether a time-ordered material stream can fill a fixed
          set of tracks within their composition limits.
        </p>
      </div>
      <div className="method-grid">
        <section>
          <h3>1. Geometry and capacity</h3>
          <p>
            Each track is a polyline with a constant rectangular bead area.
            Track volume is length × bead width × layer height. All lower-layer
            tracks must be assigned before the next layer is available.
            Parallel, chevron and alternating-rib families are idealised
            receiving geometries.
          </p>
          <div className="formula">
            V<sub>i</sub> = l<sub>i</sub> w h<br />V<sub>cap</sub> = Σ V
            <sub>i</sub>
          </div>
          <p>
            There is no overlap correction, support solver or collision mesh.
            Direct travel is assumed clear. A drawn rib is not automatically a
            load-bearing interlock.
          </p>
        </section>
        <section>
          <h3>2. Composition history</h3>
          <p>
            For A → B, the fraction of B is c(v) = (v/V<sub>tr</sub>)
            <sup>γ</sup>. For B → A it is 1 - (v/V<sub>tr</sub>)<sup>γ</sup>.
            These monotonic curves are assumed inputs, not calibrated material
            laws. Changing a material label does not change properties.
          </p>
          <p>
            The global eligible window is intersected with each track's
            acceptance window. Graded targets range from 20% to 80% B along y
            and repeat in each layer. The half-width defines their tolerance.
            Uniform tracks accept the whole global window.
          </p>
          <p>
            Because c(v) is monotonic, checking both deposition endpoints proves
            that the entire track remains within its allowed window.
          </p>
        </section>
        <section>
          <h3>3. Allocation and conservation</h3>
          <p>
            Before a track is deposited, the model may purge forward to its
            earliest allowed composition. It never reverses the composition
            history. A track that cannot fit in its remaining volume window is
            left unassigned. All unused transition volume is counted as external
            discard.
          </p>
          <div className="formula">
            V<sub>tr</sub> = V<sub>use</sub> + V<sub>dis</sub>
            <br />V<sub>use</sub> ≤ min(V<sub>elig</sub>, V<sub>cap</sub>)
          </div>
          <p>
            An incomplete allocation is not a complete part. Remaining geometry
            requires a separate clean-material operation outside this model. No
            extra switch is silently introduced.
          </p>
        </section>
        <section>
          <h3>4. Search and comparison</h3>
          <p>
            <b>Fixed raster:</b> original track order, forward direction.
            Impossible tracks are skipped and reported. <b>Nearest feasible:</b>{" "}
            greedily minimises direct travel + 3 × purge-before volume in its
            candidate-ranking heuristic (3 mm per mm³). This coefficient is a
            heuristic, not a physical law.
          </p>
          <p>
            <b>Adaptive search:</b> seeded random construction of feasible
            routes, biased by the same heuristic and reinforced successful
            connections. It is an experimental edge-reinforcement algorithm
            inspired by transport adaptation, not an implementation of the
            canonical Slime Mould Algorithm.
          </p>
          <div className="formula">
            J = α V<sub>dis</sub>/V<sub>tr</sub> + (1 - α) L/L<sub>ref</sub>
          </div>
          <p>
            Complete routes rank above partial ones; among partial routes,
            higher assigned volume ranks first. J breaks equal-coverage
            comparisons. L<sub>ref</sub> is the number of tracks × the domain
            diagonal. The first seed is displayed; all replicate results are
            retained.
          </p>
          <p>
            The weight α reports a composite cost; it does not trade away
            coverage. At equal assigned volume the discard term is constant, so
            all α below 1 prefer the shorter route. At α = 1 travel is not
            distinguished.
          </p>
        </section>
      </div>
      <section className="method-wide">
        <h3>Analytical verification case</h3>
        <p>
          Two 60 mm tracks each require 6 mm³. A joins (10, 0) to (70, 0); B
          joins (0, 10) to (60, 10), in millimetres. The nozzle starts at (0,
          10). A accepts 0-50% B and B accepts 50-100% B. The transition is
          linear over 12 mm³; purging and extra switching are prohibited.
        </p>
        <p>
          All eight order/direction combinations are enumerated. The
          unconstrained geometric minimum B-A travels √200 ≈ 14.142 mm but
          violates composition. The shortest feasible A-B route travels 2√200 ≈
          28.284 mm and allocates all 12 mm³. This is a mathematical example,
          not a printer measurement.
        </p>
      </section>
      <section className="method-wide limitations">
        <h3>Scope of scientific claims</h3>
        <p>
          InfillLab predicts allocation and idealised travel. It does not
          predict adhesion, tensile strength, compression behaviour, energy
          absorption, thermal history, viscosity or failure. Reinforcement needs
          independent material characterisation and mechanical comparison
          against an identical clean-material interlock. Layer-stack rendering
          is a geometric projection, not finite-element analysis. No
          machine-ready G-code is produced.
        </p>
        <p>
          Timing uses constant deposition/travel speeds and a purge flow rate.
          It excludes acceleration, retraction, temperature changes,
          material-switch delays and travel to the purge station. Partial runs
          cover different deposited amounts and must not be compared as equally
          completed prints.
        </p>
      </section>
      <section className="method-wide">
        <h3>Reproducibility</h3>
        <p>
          Export JSON to preserve the full parameter set, model version, all
          schedules, random seeds and convergence histories. Importing a file
          validates its configuration and recomputes results; it does not trust
          stored metrics. CSV contains summary rows for the compared methods and
          all adaptive replicates. Browser runtime varies with hardware and is
          reported separately from the ideal process time.
        </p>
      </section>
      <section className="method-wide">
        <h3>Literature informing the study</h3>
        <p>
          These sources motivate the research question. They do not calibrate
          the numerical inputs used here.
        </p>
        <ol className="references">
          {papers.map(([author, title, doi]) => (
            <li key={doi}>
              <span>{author}</span>{" "}
              <a
                href={`https://doi.org/${doi}`}
                target="_blank"
                rel="noreferrer"
              >
                {title}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
