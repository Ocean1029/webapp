"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BsChatTextFill, BsClockHistory, BsPeopleFill } from "react-icons/bs";

const NAV_ITEMS = [
  { href: "/",        icon: BsChatTextFill, title: "分析"     },
  { href: "/history", icon: BsClockHistory, title: "歷史紀錄" },
  { href: "/people",  icon: BsPeopleFill,   title: "人物"     },
];

export default function Navbar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="w-full bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-gray-900 hover:text-indigo-600 transition-colors"
        >
          EchoText
        </Link>
        <div className="flex items-center gap-2">
          {NAV_ITEMS.map(({ href, icon: Icon, title }) => (
            <Link
              key={href}
              href={href}
              title={title}
              className={`p-2 rounded-lg transition-colors ${
                isActive(href)
                  ? "text-indigo-600 bg-indigo-50"
                  : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
