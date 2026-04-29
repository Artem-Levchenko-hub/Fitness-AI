import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3a6b4a",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100"
          height="100"
          viewBox="0 0 512 512"
          fill="none"
        >
          <g transform="translate(256,256)">
            <rect
              x="-120"
              y="-10"
              width="240"
              height="20"
              rx="10"
              fill="#f6f4ef"
            />
            <rect
              x="-150"
              y="-52"
              width="28"
              height="104"
              rx="8"
              fill="#f6f4ef"
            />
            <rect
              x="-118"
              y="-40"
              width="22"
              height="80"
              rx="6"
              fill="#f6f4ef"
            />
            <rect
              x="96"
              y="-40"
              width="22"
              height="80"
              rx="6"
              fill="#f6f4ef"
            />
            <rect
              x="122"
              y="-52"
              width="28"
              height="104"
              rx="8"
              fill="#f6f4ef"
            />
          </g>
        </svg>
      </div>
    ),
    { ...size },
  );
}
