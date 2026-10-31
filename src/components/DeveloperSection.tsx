import {
  Home, User, Cpu, HardHat, FlaskConical, Award, Heart, Lightbulb, Radar,
  GraduationCap, Trophy, Camera, Leaf, Users, Activity, BookOpen,
} from 'lucide-react';
import type { Route } from './types';

export function DeveloperSection({ onNavigate }: { onNavigate: (r: Route) => void }) {
  return (
    <div className="min-h-screen bg-[#20272D] flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#465761]/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate({ name: 'launch' })} className="btn-ghost !px-2 !py-2">
            <Home className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-base font-bold text-[#C7D0D5]">Developer / About</h1>
            <p className="text-xs text-[#C7D0D5]/50 font-mono">The student behind Blindspot</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {/* Hero */}
        <div className="panel p-6 mb-6 bg-gradient-to-br from-[#29343D] to-[#20272D]">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#66D9E8]/15 flex items-center justify-center shrink-0">
              <User className="w-8 h-8 text-[#66D9E8]" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-[#C7D0D5] mb-1">Ruchit Blaggana</h2>
              <p className="text-sm text-[#C7D0D5]/60 mb-2">
                Grade 12 · Delhi Public School, Vasant Kunj, New Delhi
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="badge badge-cyan">Computer Science</span>
                <span className="badge badge-amber">Intended: USA · Canada · Australia</span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. About the Developer */}
        <Section icon={<User className="w-5 h-5" />} title="About the Developer" color="cyan">
          <p>
            Ruchit Blaggana is a Grade 12 student at Delhi Public School, Vasant Kunj, New Delhi,
            pursuing Computer Science as his intended major. He plans to study in the United States,
            Canada, or Australia. His academic record reflects consistent excellence alongside a deep
            commitment to leadership, community service, and technical innovation.
          </p>
        </Section>

        {/* Academic record */}
        <Section icon={<GraduationCap className="w-5 h-5" />} title="Academic Record" color="cyan">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 not-prose">
            <GradeCard grade="9" score="93.2%" />
            <GradeCard grade="10" score="94.4%" />
            <GradeCard grade="11" score="80.4%" />
            <GradeCard grade="12" score="Pursuing" />
          </div>
        </Section>

        {/* 2. Robotics and Technical Experience */}
        <Section icon={<Cpu className="w-5 h-5" />} title="Robotics and Technical Experience" color="cyan">
          <p>
            Ruchit completed a summer program in Artificial Intelligence, Machine Learning, and Robotics
            at <strong className="text-[#C7D0D5]">IIT Delhi</strong> through Rancho Labs. The program
            combined hardware programming, sensor integration, and robotics prototyping — providing
            the technical foundation that directly informs Blindspot's sensor-based navigation model.
          </p>
        </Section>

        {/* 3. The Smart Hat Project */}
        <Section icon={<HardHat className="w-5 h-5" />} title="The Smart Hat Project" color="amber" featured>
          <p>
            During the IIT Delhi summer program, Ruchit designed and developed a{' '}
            <strong className="text-[#F0B95A]">Smart Hat for the Visually Impaired</strong> using an
            Arduino Uno microcontroller and an ultrasonic sensor. The hat detects overhead obstacles
            that traditional white canes cannot sense — low-hanging branches, signs, open doors — and
            alerts the wearer through haptic or auditory feedback.
          </p>
          <div className="grid grid-cols-2 gap-3 not-prose mt-4">
            <ProjectTag icon={<Cpu className="w-4 h-4" />} label="Arduino Uno" />
            <ProjectTag icon={<Radar className="w-4 h-4" />} label="Ultrasonic Sensor" />
            <ProjectTag icon={<HardHat className="w-4 h-4" />} label="Wearable Hardware" />
            <ProjectTag icon={<Heart className="w-4 h-4" />} label="Human-Centered Design" />
          </div>
          <div className="not-prose mt-4 p-4 bg-[#20272D] rounded-lg border-l-2 border-[#66D9E8]">
            <p className="text-sm text-[#66D9E8] italic">
              "This project is the authentic connection between Ruchit's experience and Blindspot's
              sensor-based navigation challenges."
            </p>
          </div>
        </Section>

        {/* 4. Research and Innovation */}
        <Section icon={<FlaskConical className="w-5 h-5" />} title="Research and Innovation" color="mint">
          <ul>
            <li>
              <strong className="text-[#C7D0D5]">Patent application filed (pending review):</strong>{' '}
              Co-development of an innovative instrument. The patent application has been filed and is
              currently pending review.
            </li>
            <li>
              <strong className="text-[#C7D0D5]">Research support:</strong>{' '}
              Data compilation and research support for a dentistry-related article currently under publication.
            </li>
          </ul>
        </Section>

        {/* 5. Academic Achievements */}
        <Section icon={<Trophy className="w-5 h-5" />} title="Academic Achievements" color="amber">
          <div className="space-y-2 not-prose">
            <Achievement icon={<Award className="w-4 h-4" />} text="Scholar Badge of Excellence — received consistently throughout school" />
            <Achievement icon={<Trophy className="w-4 h-4" />} text="Gold Medal for Academic Excellence in Grade 11" />
            <Achievement icon={<Trophy className="w-4 h-4" />} text="Regional Rank 3 and School Rank 1 — Vigyan Vidyarthi Manthan" />
            <Achievement icon={<Camera className="w-4 h-4" />} text="Second prize — national-level photography competition" />
            <Achievement icon={<Leaf className="w-4 h-4" />} text="Certificate of Recognition — World Environment Day global quiz" />
            <Achievement icon={<BookOpen className="w-4 h-4" />} text="Certificate of Distinction — CMS Environmental Quiz Competition" />
            <Achievement icon={<Trophy className="w-4 h-4" />} text="Winning team (Rolling Trophy) — Inter-School Luminaire Competition" />
            <Achievement icon={<Activity className="w-4 h-4" />} text="Bronze medal — Inter-School Swimming Competition, 2024" />
          </div>
        </Section>

        {/* 6. Leadership and Community Impact */}
        <Section icon={<Heart className="w-5 h-5" />} title="Leadership and Community Impact" color="mint">
          <div className="space-y-3">
            <div className="flex gap-3">
              <Users className="w-4 h-4 text-[#83D6A4] shrink-0 mt-1" />
              <div>
                <strong className="text-[#C7D0D5]">Secretary, Interact Club</strong> — Leadership in
                community outreach, fundraising, volunteer coordination, and social-impact initiatives.
                Received a Letter of Recommendation from the Interact Club.
              </div>
            </div>
            <div className="flex gap-3">
              <Heart className="w-4 h-4 text-[#83D6A4] shrink-0 mt-1" />
              <div>
                <strong className="text-[#C7D0D5]">Fundraising for social welfare</strong> — Activities
                supporting orphanages, elderly care, and social welfare organizations.
              </div>
            </div>
            <div className="flex gap-3">
              <GraduationCap className="w-4 h-4 text-[#83D6A4] shrink-0 mt-1" />
              <div>
                <strong className="text-[#C7D0D5]">Financial literacy workshop</strong> — Designed and
                conducted a financial literacy workshop for government-school students.
              </div>
            </div>
            <div className="flex gap-3">
              <Leaf className="w-4 h-4 text-[#83D6A4] shrink-0 mt-1" />
              <div>
                <strong className="text-[#C7D0D5]">Sustainability initiatives</strong> — Paper recycling
                and textile sustainability programs.
              </div>
            </div>
            <div className="flex gap-3">
              <Users className="w-4 h-4 text-[#83D6A4] shrink-0 mt-1" />
              <div>
                <strong className="text-[#C7D0D5]">Earth Saviours Foundation volunteer</strong> —
                Supporting homeless and elderly residents through caregiving, reading sessions, medicine
                distribution, and day-to-day assistance.
              </div>
            </div>
          </div>
        </Section>

        {/* 7. Why Blindspot Was Built */}
        <Section icon={<Lightbulb className="w-5 h-5" />} title="Why Blindspot Was Built" color="cyan" featured>
          <p>
            Blindspot: Robot Trials is an exploration of a fundamental robotics challenge:{' '}
            <strong className="text-[#66D9E8]">how can a robot navigate an environment when it cannot
            see everything around it?</strong>
          </p>
          <p>
            Drawing on his experience building the Smart Hat — where an ultrasonic sensor provided
            limited, imperfect information about the world — Ruchit designed Blindspot to demonstrate
            that intelligent navigation does not require a complete map or a machine learning model.
            It requires sensor geometry, collision constraints, explicit algorithms, and the ability to
            make good decisions with incomplete information.
          </p>
          <p>
            The game implements real computer science concepts: raycasting sensors, DDA grid traversal,
            A* pathfinding, frontier-based exploration, reactive control policies, wall-following
            strategies, deterministic simulation, and reproducible experimentation. Every sensor reading
            is calculated from the environment. Every collision is physical. Every navigation decision
            comes from an inspectable algorithm.
          </p>
          <div className="not-prose mt-4 p-4 bg-[#20272D] rounded-lg text-center">
            <p className="font-display text-lg text-[#66D9E8]">
              Intelligence begins where vision ends.
            </p>
          </div>
        </Section>

        {/* Footer note */}
        <div className="text-center py-6 text-xs text-[#C7D0D5]/30 font-mono">
          <p>No personal contact information is published by default.</p>
          <p className="mt-1">Blindspot: Robot Trials — Built by Ruchit Blaggana, 2026</p>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon, title, color, children, featured,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
  featured?: boolean;
}) {
  const colors: Record<string, string> = {
    cyan: 'text-[#66D9E8] border-[#66D9E8]/20',
    amber: 'text-[#F0B95A] border-[#F0B95A]/20',
    mint: 'text-[#83D6A4] border-[#83D6A4]/20',
  };
  return (
    <div className={`panel p-6 mb-4 ${featured ? `border ${colors[color]}` : ''}`}>
      <h2 className={`font-display text-lg font-bold mb-3 flex items-center gap-2 ${colors[color]}`}>
        {icon} {title}
      </h2>
      <div className="text-sm text-[#C7D0D5]/70 leading-relaxed space-y-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2">
        {children}
      </div>
    </div>
  );
}

function GradeCard({ grade, score }: { grade: string; score: string }) {
  return (
    <div className="bg-[#20272D] rounded-lg p-3 text-center">
      <div className="text-xs text-[#C7D0D5]/40 uppercase tracking-wider">Grade {grade}</div>
      <div className="font-mono font-bold text-lg text-[#66D9E8] mt-1">{score}</div>
    </div>
  );
}

function ProjectTag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#20272D] rounded-lg px-3 py-2 text-xs">
      <span className="text-[#F0B95A]">{icon}</span>
      <span className="text-[#C7D0D5]/70">{label}</span>
    </div>
  );
}

function Achievement({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-[#C7D0D5]/70">
      <span className="text-[#F0B95A] shrink-0 mt-0.5">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
