import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { GoldUnderline, useLandingDestinations, type RouteTarget } from "./shared";

interface WorkspaceCardSpec {
  id: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  imgWidth: number;
  imgHeight: number;
  isPortrait?: boolean;
  target: RouteTarget;
}

export function WorkspaceShowcase() {
  const { workspaces } = useLandingDestinations();

  const cards: WorkspaceCardSpec[] = [
    {
      id: "hospital-operations",
      title: "Hospital Operations",
      description:
        "Coordinate people, beds, resources, and care flow across the hospital.",
      image: "/assets/landing/hospital-operations.png",
      imageAlt: "Hospital building surrounded by greenery",
      imgWidth: 164,
      imgHeight: 90,
      target: workspaces.hospitalOperations,
    },
    {
      id: "clinician-workspace",
      title: "Clinician Workspace",
      description:
        "A focused, intelligent space for assessment, care planning, and follow-up.",
      image: "/assets/landing/clinician-workspace.png",
      imageAlt: "Clinician reviewing patient care records on a tablet",
      imgWidth: 164,
      imgHeight: 105,
      isPortrait: true,
      target: workspaces.clinicianWorkspace,
    },
    {
      id: "patient-kiosk",
      title: "Patient Kiosk",
      description:
        "A simple, assisted experience for check-in, intake, and care guidance.",
      image: "/assets/landing/patient-kiosk.png",
      imageAlt: "Patient check-in kiosk terminal displaying JEEVIKA",
      imgWidth: 164,
      imgHeight: 90,
      target: workspaces.patientKiosk,
    },
    {
      id: "pharmacy-inventory",
      title: "Pharmacy & Inventory",
      description:
        "Manage prescriptions, stock, and fulfillment with end-to-end visibility.",
      image: "/assets/landing/pharmacy-inventory.png",
      imageAlt: "Organized pharmacy shelves and medical cross signage",
      imgWidth: 164,
      imgHeight: 90,
      target: workspaces.pharmacyInventory,
    },
    {
      id: "home-recovery",
      title: "Home Recovery",
      description:
        "Continue care at home with follow-ups, reminders, and recovery support.",
      image: "/assets/landing/home-recovery.png",
      imageAlt: "Home surrounded by sunlit trees representing recovery at home",
      imgWidth: 164,
      imgHeight: 90,
      target: workspaces.homeRecovery,
    },
  ];

  return (
    <div id="workspaces" className="scroll-mt-20 pb-14 lg:pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header split row */}
        <div data-jvk-reveal="" className="mb-8 flex flex-col justify-between gap-4 lg:mb-10 lg:flex-row lg:items-end">
          <h2 className="text-3xl font-bold tracking-tight text-[#0E2420] sm:text-4xl">
            Five connected{" "}
            <span className="relative inline-block jeevika-serif-italic pr-1">
              workspaces.
              <GoldUnderline className="absolute -bottom-1 left-0 h-2.5 w-full" />
            </span>
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-[#435650] sm:text-[15px]">
            Purpose-built spaces for every part of the care ecosystem, working
            together on a single, connected platform.
          </p>
        </div>

        {/* 5-Column Workspace Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4 xl:gap-5">
          {cards.map((card, index) => (
            <Link
              key={card.id}
              to={card.target.to}
              state={card.target.state}
              data-jvk-reveal={Math.min(index, 3)}
              className="jvk-motion-card group relative flex flex-col rounded-2xl border border-[#EAE6DC] bg-[#FFFDF8] p-4 shadow-[0_6px_22px_rgba(14,36,32,0.04)] hover:border-[#047C61]/45 hover:shadow-[0_10px_28px_rgba(4,124,97,0.08)] sm:p-5"
            >
              <div className="mb-3 flex h-24 w-full items-end justify-center overflow-visible">
                <img
                  src={card.image}
                  alt={card.imageAlt}
                  width={card.imgWidth}
                  height={card.imgHeight}
                  loading="lazy"
                  className={`max-w-full object-contain ${
                    card.isPortrait ? "h-[104px] w-auto -mt-3" : "h-[88px] w-auto"
                  }`}
                />
              </div>

              <h3 className="text-[15px] font-bold leading-snug text-[#0E2420] group-hover:text-[#047C61] xl:text-base">
                {card.title}
              </h3>

              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-[#4B5D57] xl:text-[13px]">
                {card.description}
              </p>

              <div className="mt-3 flex justify-end text-[#047C61]">
                <ArrowRight
                  aria-hidden="true"
                  className="jvk-motion-arrow size-4 stroke-[2]"
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
