import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

export interface EmailVerificationProps {
  name: string;
  confirmUrl: string;
  /** Código corto opcional (para mostrar en el correo) */
  code?: string;
}

export function EmailVerification({
  name,
  confirmUrl,
  code,
}: EmailVerificationProps) {
  const firstName = name.trim().split(/\s+/)[0] || "hola";

  return (
    <Html lang="es">
      <Head />
      <Preview>Confirma tu correo y activa tu cuenta en NEXORA</Preview>
      <Tailwind>
        <Body className="bg-[#f3f6f4] font-sans">
          <Container className="mx-auto my-8 max-w-[560px] rounded-2xl bg-[#f1f5f7] px-8 py-10 shadow-sm">
            <Section className="text-center">
              <Text className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-[#0f766e]">
                Conjuntos residenciales
              </Text>
              <Heading className="m-0 mt-2 text-3xl font-semibold tracking-tight text-[#0f766e]">
                NEXORA
              </Heading>
            </Section>

            <Section className="mt-8">
              <Heading
                as="h2"
                className="m-0 text-xl font-semibold text-[#0f1f1a]"
              >
                ¡Bienvenido/a, {firstName}!
              </Heading>
              <Text className="mt-3 text-[15px] leading-relaxed text-[#5c6f68]">
                Gracias por registrarte en NEXORA. Para activar tu cuenta y
                acceder al panel de tu conjunto, confirma tu correo electrónico
                con el botón de abajo.
              </Text>
            </Section>

            <Section className="mt-8 text-center">
              <Button
                href={confirmUrl}
                className="rounded-lg bg-[#0f766e] px-6 py-3.5 text-[15px] font-semibold text-white no-underline"
              >
                Confirmar mi Correo y Activar Cuenta
              </Button>
            </Section>

            {code ? (
              <Section className="mt-6 rounded-xl bg-[#f3f6f4] px-4 py-4 text-center">
                <Text className="m-0 text-xs uppercase tracking-wide text-[#5c6f68]">
                  Código de verificación
                </Text>
                <Text className="m-0 mt-2 font-mono text-2xl font-semibold tracking-[0.25em] text-[#0f766e]">
                  {code}
                </Text>
              </Section>
            ) : null}

            <Section className="mt-6">
              <Text className="m-0 text-xs leading-relaxed text-[#5c6f68]">
                Si el botón no funciona, copia y pega este enlace en tu
                navegador:
              </Text>
              <Link
                href={confirmUrl}
                className="mt-2 block break-all text-xs text-[#0f766e] underline"
              >
                {confirmUrl}
              </Link>
            </Section>

            <Hr className="my-8 border-[#e5ebe8]" />

            <Section>
              <Text className="m-0 text-center text-xs leading-relaxed text-[#5c6f68]">
                NEXORA — Administración de conjuntos residenciales.
                <br />
                Si no creaste esta cuenta, puedes ignorar este mensaje.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default EmailVerification;
