export interface Lesson {
  id: string;
  title: string;
  category: string;
  summary: string;
  explanation: string;
  keyPoints: string[];
  challenge: string;
  relatedTrial: string;
}

export const LESSONS: Lesson[] = [
  {
    id: 'coord-systems',
    title: 'Robot Coordinate Systems',
    category: 'Foundations',
    summary: 'How a robot knows where it is and which way it faces.',
    explanation:
      'A robot in a 2D environment has a position (x, y) and a heading (angle in radians). Heading 0 points right (+x), PI/2 points down (+y in screen coordinates), PI points left, and -PI/2 points up. All movement commands are relative to the heading: "forward" means moving in the direction the robot faces.',
    keyPoints: [
      'Position is (x, y) in world units.',
      'Heading is an angle in radians, measured from the +x axis.',
      'Angles wrap to the range [-PI, PI].',
      'The shortest turn between two headings may be clockwise or counter-clockwise.',
    ],
    challenge: 'In the Trial Arena, switch to Manual Control and rotate the robot. Watch the heading value change in the telemetry panel.',
    relatedTrial: 'trial-01',
  },
  {
    id: 'distance-calc',
    title: 'Distance Calculations',
    category: 'Foundations',
    summary: 'Measuring how far things are using geometry.',
    explanation:
      'The Euclidean distance between two points (x1, y1) and (x2, y2) is sqrt((x2-x1)^2 + (y2-y1)^2). Sensors return the distance to the nearest obstacle along a ray. The robot uses this to decide whether it is safe to move forward.',
    keyPoints: [
      'Distance = sqrt(dx^2 + dy^2).',
      'The goal-reached check compares robot-to-goal distance against a radius.',
      'Path efficiency = straight-line distance / actual distance travelled.',
    ],
    challenge: 'In Trial 01, check the telemetry: the "Goal Distance" value shrinks as you approach the goal.',
    relatedTrial: 'trial-01',
  },
  {
    id: 'sensor-fov',
    title: 'Sensor Fields of View',
    category: 'Sensing',
    summary: 'A sensor only sees what is inside its detection cone.',
    explanation:
      'Each sensor has a range (how far it sees) and a field of view (the angular width of its detection cone). The FOV is a full angle — a 60° FOV means the sensor covers 30° to each side of its pointing direction. Anything outside this cone is invisible, no matter how close. This is the source of blind spots.',
    keyPoints: [
      'Range limits how far a sensor detects.',
      'FOV limits the angular width of detection.',
      'A single forward sensor cannot see obstacles to the side or behind.',
      'More sensors = wider coverage but more energy per measurement cycle.',
    ],
    challenge: 'In the Robot Workshop, switch between Single, Triple, and Omni sensor presets. Watch the FOV cones change in the arena.',
    relatedTrial: 'trial-03',
  },
  {
    id: 'obstacle-detection',
    title: 'Obstacle Detection',
    category: 'Sensing',
    summary: 'How a sensor ray finds the nearest obstacle.',
    explanation:
      'The sensor casts a ray from the robot position along its pointing direction. Using a DDA (Digital Differential Analyzer) algorithm, the ray steps through the grid cell by cell until it hits a wall or reaches its maximum range. For circular obstacles, a ray-circle intersection test finds the entry point. The nearest hit across all obstacle types is the reported distance.',
    keyPoints: [
      'DDA raycasting is efficient for grid environments.',
      'Ray-circle intersection uses the quadratic formula.',
      'The sensor reports the nearest hit, not all hits.',
      'If nothing is hit within range, the sensor reports "clear" (null distance).',
    ],
    challenge: 'In Trial 04, approach a wall and watch the sensor reading decrease. Back away and watch it increase.',
    relatedTrial: 'trial-04',
  },
  {
    id: 'collision-detection',
    title: 'Collision Detection',
    category: 'Movement',
    summary: 'Why the robot cannot pass through walls.',
    explanation:
      'The robot has a circular collision footprint (radius r). Before each movement, the simulator checks whether the circle at the new position overlaps any wall cell or circular obstacle. If it does, movement is blocked and the robot slides along the surface. To prevent tunneling at high speeds, movement is split into substeps no larger than r/2.',
    keyPoints: [
      'The robot is a circle, not a point — its radius matters.',
      'Substepping prevents tunneling through thin walls.',
      'Collisions produce a state change to "Collision" and an event log entry.',
      'Each collision reduces the final score.',
    ],
    challenge: 'In Trial 01, drive the robot into a wall. You will stop and see a collision event in the log.',
    relatedTrial: 'trial-01',
  },
  {
    id: 'measurement-uncertainty',
    title: 'Measurement Uncertainty',
    category: 'Sensing',
    summary: 'Real sensors are noisy — and that changes decisions.',
    explanation:
      'Simulated noise is added to each distance measurement as Gaussian random noise with a configurable standard deviation. A noise std of 0.4 means readings deviate by about 0.4 units on average. The noise is seeded — the same seed and configuration produce the same sequence of noisy readings, making experiments reproducible. Noise can cause false-positive obstacle detections or miss real ones.',
    keyPoints: [
      'Noise is Gaussian with configurable standard deviation.',
      'The noise seed is part of the experiment configuration.',
      'Same seed + same config = same noise sequence (reproducible).',
      'Robust algorithms use thresholds or averaging to handle noise.',
    ],
    challenge: 'In Trial 04, run the same trial twice with the same seed. The noise pattern will be identical. Then change the seed and compare.',
    relatedTrial: 'trial-04',
  },
  {
    id: 'reactive-control',
    title: 'Reactive Control',
    category: 'Algorithms',
    summary: 'Decisions based only on current sensor readings.',
    explanation:
      'A reactive controller maps sensor readings directly to movement commands without memory or planning. If an obstacle is detected on the left, turn right. If the path is clear, move forward. These controllers are fast and handle dynamic obstacles well, but they can oscillate in narrow spaces and have no concept of a global route.',
    keyPoints: [
      'No memory — only the current reading matters.',
      'Fast response to dynamic obstacles.',
      'Can oscillate in tight spaces.',
      'No guarantee of reaching the goal.',
    ],
    challenge: 'In Trial 05, use the Reactive algorithm against moving obstacles. Watch how it dodges — and how it might wander.',
    relatedTrial: 'trial-05',
  },
  {
    id: 'wall-following',
    title: 'Wall Following',
    category: 'Algorithms',
    summary: 'Hugging a wall to explore an unknown environment.',
    explanation:
      'Wall following (the "right-hand rule") keeps a wall on one side of the robot. If the wall disappears (an opening), the robot turns to follow it. If the robot hits a wall ahead, it turns away from the followed wall. In a simply-connected maze, wall following is guaranteed to eventually visit every wall and reach any connected goal. In mazes with disconnected islands, it can fail.',
    keyPoints: [
      'Right-hand or left-hand rule.',
      'Guaranteed to solve simply-connected mazes.',
      'Can fail if the goal is on a disconnected island.',
      'Often takes long detours.',
    ],
    challenge: 'In Trial 02, use Wall Following around the corner. Compare it to Greedy — which one gets stuck?',
    relatedTrial: 'trial-02',
  },
  {
    id: 'greedy-nav',
    title: 'Greedy Navigation',
    category: 'Algorithms',
    summary: 'Always head toward the goal — until you cannot.',
    explanation:
      'Greedy goal-seeking computes the direction to the goal and turns toward it. When the path ahead is clear, it drives forward. When blocked, it turns toward whichever side has more clearance. The weakness: in a U-shaped obstacle, greedy will drive into the concavity, turn back and forth, and never escape — it has no memory of having tried this before.',
    keyPoints: [
      'Always turns toward the goal when free.',
      'No memory of previously-tried directions.',
      'Trapped by U-shaped and concave obstacles.',
      'Fast and effective in open or convex environments.',
    ],
    challenge: 'In Trial 02, try Greedy against the corner. Watch it get stuck against the wall.',
    relatedTrial: 'trial-02',
  },
  {
    id: 'astar',
    title: 'A* Pathfinding',
    category: 'Algorithms',
    summary: 'Optimal path planning on a known map.',
    explanation:
      'A* searches the grid from the start to the goal, using a priority queue ordered by f = g + h, where g is the cost from the start and h is a heuristic estimate (Manhattan distance) to the goal. It expands the most promising cells first and is guaranteed to find the shortest path if the heuristic never overestimates. Crucially, A* requires the full map — it is not a blind-navigation algorithm.',
    keyPoints: [
      'Optimal: finds the shortest path on a grid.',
      'Requires the complete (or known) map.',
      'Uses a heuristic to guide the search efficiently.',
      'Not comparable to blind local-navigation algorithms.',
    ],
    challenge: 'In the Algorithm Lab, run A* on a maze and compare its path efficiency to wall following.',
    relatedTrial: 'trial-06',
  },
  {
    id: 'exploration-mapping',
    title: 'Exploration and Mapping',
    category: 'Algorithms',
    summary: 'Building a map from sensor data, one cell at a time.',
    explanation:
      'Frontier exploration maintains an occupancy grid: each cell is unknown, free, or wall. As the robot senses, it marks cells along each sensor ray as free (up to the hit distance) and the hit cell as wall. A "frontier" is a known-free cell adjacent to an unknown cell. The robot navigates to the nearest frontier, expanding its map until the goal is found.',
    keyPoints: [
      'Builds an occupancy grid incrementally.',
      'Frontiers are boundaries between known and unknown.',
      'Once the goal cell is known-free, A* on the known map navigates there.',
      'Slower than direct navigation but works in unknown environments.',
    ],
    challenge: 'In Trial 07, use Frontier Exploration and watch the known map fill in as the robot explores.',
    relatedTrial: 'trial-07',
  },
  {
    id: 'energy-budgeting',
    title: 'Energy Budgeting',
    category: 'Planning',
    summary: 'Every action costs energy — spend it wisely.',
    explanation:
      'The robot consumes energy for movement (per unit distance), turning (per radian), and sensor measurements (per reading). A trial with a tight battery budget forces trade-offs: a shorter route that requires many sensor readings might cost more than a longer route with fewer readings. Charging stations restore energy but require a detour.',
    keyPoints: [
      'Movement, turning, and sensing all cost energy.',
      'More sensors = more energy per measurement cycle.',
      'Charging stations restore energy but cost time.',
      'Scoring rewards energy efficiency.',
    ],
    challenge: 'In Trial 06, decide whether to detour to the charging station or take the direct route. Compare your score.',
    relatedTrial: 'trial-06',
  },
  {
    id: 'deterministic-sim',
    title: 'Deterministic Simulation',
    category: 'Engineering',
    summary: 'Same seed, same result — the foundation of reproducible experiments.',
    explanation:
      'The simulator uses a fixed time step (1/60 second) and a seeded pseudo-random number generator (Mulberry32). The same environment seed produces the same maze; the same noise seed produces the same measurement noise. This means any experiment can be reproduced exactly, and two algorithms can be compared under identical conditions by sharing the seeds.',
    keyPoints: [
      'Fixed 60 Hz time step independent of frame rate.',
      'Seeded RNG for environment generation and noise.',
      'Reproducible: same seeds = same run.',
      'Essential for fair algorithm comparison.',
    ],
    challenge: 'In the Algorithm Lab, run the same algorithm twice with the same seed. The results should be identical.',
    relatedTrial: 'trial-08',
  },
  {
    id: 'algorithm-comparison',
    title: 'Algorithm Comparison',
    category: 'Engineering',
    summary: 'Why there is no single best navigation algorithm.',
    explanation:
      'Different algorithms excel in different environments. A* is optimal on known maps but useless without one. Wall following solves mazes but takes long detours. Greedy is fast in open spaces but traps itself in concavities. Reactive handles dynamic obstacles but wanders. The Algorithm Lab lets you run multiple algorithms under identical conditions and compare metrics side by side.',
    keyPoints: [
      'No algorithm is universally best.',
      'Information access (known vs. unknown map) changes everything.',
      'Compare under identical seeds and configurations.',
      'Metrics: success, time, collisions, energy, path efficiency.',
    ],
    challenge: 'In the Algorithm Lab, compare Wall Following and Reactive on the same maze. Which reaches the goal? Which is faster?',
    relatedTrial: 'trial-08',
  },
];
