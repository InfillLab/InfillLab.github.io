import { PATTERNS } from "../model/patterns";
export default function Methods() {
  return (
    <article className="methods">
      <div className="eyebrow">
        MODEL 2.0 / SCOPE, ASSUMPTIONS & VERIFICATION
      </div>
      <h1>What this experiment can establish.</h1>
      <p>
        InfillLab tests the chronological allocation of a material-switch
        transition to receiving paths in one layer. It compares schedules,
        accepted volume and non-extruding travel. It does not establish
        adhesion, tensile strength, compressive energy absorption or
        printability.
      </p>
      <div className="notice">
        TAII (Transition-Aware Interlaced Infill) is an experimental finger-path
        proposal. A higher reuse fraction is not evidence of a stronger joint,
        and neither mechanical benefit nor originality is established here.
      </div>
      <h2>Hardware and material history</h2>
      <p>
        The multi-material model applies only to a shared melt path.
        Separate-nozzle systems, including IDEX, have no shared chamber
        transition represented by this model. A shared nozzle creates a
        changeover interval but does not guarantee a homogeneous or compatible
        polymer blend. Material names and colours are labels. Soft TPU feeding
        and actual printer compatibility require independent verification.
      </p>
      <p>
        The assumed B volume fraction is cB(v) = (v/Vtr)^γ for A to B and 1 -
        (v/Vtr)^γ for B to A. This monotonic surrogate must be calibrated for a
        specific material pair and extrusion system before making physical
        claims. Pure-material strokes in the animation are context only, outside
        the transition budget. Playback speed is illustrative, not printer time.
      </p>
      <h2>Geometry, reference families and the proposed tenth pattern</h2>
      <p>
        The nine names follow surface-fill families used in slicers. They are
        not nine independent structural infill inventions. The simulator uses
        simplified centreline constructions; no claim of bit-for-bit equivalence
        to Bambu Studio or OrcaSlicer is made. In a single rectangular layer,
        some variants coincide.
      </p>
      <table>
        <thead>
          <tr>
            <th>Pattern</th>
            <th>Implementation and scheduling constraints</th>
          </tr>
        </thead>
        <tbody>
          {PATTERNS.map((p) => (
            <tr key={p.id}>
              <th>{p.name}</th>
              <td>{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Connected reference curves preserve segment order and direction.
        Monotonic variants preserve global order. Other paths may be reordered
        and reversed. Candidate allocation segments have nominal length max(2
        mm, total controlled length / 70), with shorter residual segments at
        path ends. This segmentation affects feasibility and is part of the
        experimental definition. Optimising a reference changes its execution
        order only where allowed.
      </p>
      <p>
        Native mode retains the generated geometry and its own nominal capacity.
        Equal-volume mode uses the minimum native capacity across all ten
        patterns and proportionally trims the end of each native path to match
        that budget. A trimmed curve may not retain the full appearance or
        coverage of its native pattern. Equal capacity does not equal identical
        topology or spatial coverage.
      </p>
      <p>
        Vcap is the sum of centreline length × bead width × layer height. It is
        a nominal path-volume budget, not a Boolean union of deposited solids.
        Bead overlap, sharp corners, crossing paths, pressure, thermal history
        and nozzle clearance are not resolved. In particular, spiral centres and
        the proposed interlacing require geometric and manufacturing validation.
      </p>
      <h2>Acceptance and chronological allocation</h2>
      <p>
        Each segment has a local interval [low, high] for cB. In graded mode,
        its target is 0.15 + 0.7 × mean(vertex y) / region height, with a
        user-defined half-width and clipping to [0, 1]. Uniform mode uses [0,
        1]. These are design assumptions, not measured compatibility limits.
        Global eligibility intersects each local interval.
      </p>
      <p>
        Because cB(v) is monotonic, the algorithm checks both endpoints of the
        whole segment's volume interval. Accepted segments consume the next
        available suitable transition volume. An earlier unsuitable interval can
        be purged externally; the extrusion cursor never moves backwards.
        Unassigned segments stay unfilled. Predecessor constraints prevent
        depositing a later part of an ordered curve before its earlier part.
      </p>
      <div className="formula">
        Vuse + Vdis = Vtr
        <br />η = Vuse / Vtr ≤ min(Vcap, Velig) / Vtr
      </div>
      <p>
        The bound ignores chronology and individual windows. Reaching it is not
        guaranteed. For animation, each accepted or discarded interval is
        subdivided into increments no larger than Vtr/180. These display
        increments do not change segment-level decisions. Live accepted and
        discarded totals are cumulative; remaining volume decreases. Avoided
        discard equals accepted volume against a discard-all baseline. An
        external purge receives y = 0, and accepted placement receives y = 1.
      </p>
      <h2>The 14.14 mm counterexample</h2>
      <p>
        The nozzle begins at (0, 10). Segment A runs from (10, 0) to (70, 0),
        and B from (0, 10) to (60, 10). Each requires 6 mm³. Vtr = 12 mm³ and cB
        = v/Vtr. A accepts [0, 0.5] and B accepts [0.5, 1]. This example forbids
        inter-segment purge.
      </p>
      <p>
        The shortest geometric route visits B forward, then A in reverse, with
        √200 = 14.142 mm travel. Both composition intervals are wrong. The
        complete feasible route visits A forward, then B in reverse, with 2√200
        = 28.284 mm travel. Exact enumeration checks both orders and both
        directions, eight possibilities. The red shortcut view is a rejected
        diagnostic, never a valid result or a reuse claim.
      </p>
      <h2>Search, comparison and reproducibility</h2>
      <p>
        Reference order and nearest-feasible scheduling form baselines. Adaptive
        search repeatedly samples feasible candidates and reinforces edges in
        its best schedule. It is an experimental reinforcement heuristic, not an
        implementation or validation of the canonical Slime Mould Algorithm.
        Complete schedules rank above partial schedules; among partial
        schedules, greater receiver coverage ranks first. The weighted objective
        J = α Vdis/Vtr + (1 - α) Ltravel/Lref breaks ties, where Lref is the
        number of receiver segments multiplied by the region diagonal including
        one layer height. Thus α does not trade away coverage.
      </p>
      <p>
        For a fixed configuration and seed, the schedule is reproducible. The
        main view uses the first seed; exports include every replicate and
        convergence trace. The comparison uses identical seeds and search
        budgets for all ten geometries. Native-mode volume differences must be
        interpreted with capacity and coverage. Single-material mode removes
        composition restrictions and uses nominal capacity as its deposition
        budget.
      </p>
      <p>
        JSON records the complete versioned configuration, geometry, schedules,
        traces and presentation colours. CSV includes numerical summaries and
        configuration. Version 1 experiments must be recreated because their
        patterns and layer assumptions differ. All calculations run locally in a
        browser worker; no server or account is required.
      </p>
      <h2>Sources and interpretation</h2>
      <ol>
        <li>
          <a
            href="https://github.com/OrcaSlicer/OrcaSlicer/wiki/strength_settings_patterns"
            target="_blank"
            rel="noreferrer"
          >
            OrcaSlicer: infill patterns
          </a>{" "}
          and{" "}
          <a
            href="https://github.com/OrcaSlicer/OrcaSlicer/wiki/multimaterial_settings_flush_options"
            target="_blank"
            rel="noreferrer"
          >
            flush options
          </a>
          . Pattern terminology and existing flush-to-infill practice. Reusing
          purge in infill alone is not a novelty claim.
        </li>
        <li>
          <a
            href="https://doi.org/10.36922/msam.2672"
            target="_blank"
            rel="noreferrer"
          >
            Goh et al. (2024), Enhancing interlaminar adhesion in multi-material
            3D printing.
          </a>{" "}
          Background for material interfaces, not calibration of the acceptance
          windows.
        </li>
        <li>
          <a
            href="https://doi.org/10.3390/polym18020178"
            target="_blank"
            rel="noreferrer"
          >
            Brackett et al. (2026), Transition Behavior in Blended Material
            Large Format Additive Manufacturing.
          </a>{" "}
          Transition-behaviour context; this app does not transfer large-format
          parameters to desktop printers.
        </li>
        <li>
          <a
            href="https://doi.org/10.1007/s40964-024-00570-8"
            target="_blank"
            rel="noreferrer"
          >
            Frascio et al. (2024), Investigating enhanced interfacial adhesion
            in multi-material filament 3D printing.
          </a>{" "}
          Mechanical-interface context, not proof of TAII performance.
        </li>
      </ol>
      <p className="small">
        Research status: computational demonstrator with analytical checks.
        Physical calibration, bead-level geometry validation and mechanical
        testing remain necessary before structural conclusions.
      </p>
    </article>
  );
}
