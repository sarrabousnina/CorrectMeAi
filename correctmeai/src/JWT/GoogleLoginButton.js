import { useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID =
    "726239267818-5db8k7sjccnur2oam8egk3k5r7carejj.apps.googleusercontent.com";

export default function GoogleLoginButton({ onSuccess }) {
    const divRef = useRef(null);

    useEffect(() => {
        if (!window.google || !divRef.current) return;

        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: ({ credential }) => onSuccess?.(credential),
            ux_mode: "popup",
        });

        window.google.accounts.id.renderButton(divRef.current, {
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "pill",
            logo_alignment: "left",
            width: 280,
        });
    }, [onSuccess]);

    return <div ref={divRef} />;
}
