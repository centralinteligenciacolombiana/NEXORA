import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface RegistrationDeniedEmailProps {
  userName: string;
  complexName: string;
  reason: string;
  supportEmail?: string;
}

export function RegistrationDeniedEmail({
  userName,
  complexName,
  reason,
  supportEmail = "soporte@nexora.app",
}: RegistrationDeniedEmailProps) {
  const firstName = userName.trim().split(/\s+/)[0] || "hola";

  return (
    <Html lang="es">
      <Head />
      <Preview>
        Tu registro en {complexName} no fue aprobado — NEXORA
      </Preview>
      <Body
        style={{
          backgroundColor: "#f8fafc",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          margin: 0,
          padding: "32px 16px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            margin: "0 auto",
            maxWidth: "520px",
            padding: "32px 28px",
          }}
        >
          <Text
            style={{
              color: "#0f766e",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              margin: "0 0 8px",
              textTransform: "uppercase",
            }}
          >
            NEXORA
          </Text>
          <Heading
            style={{
              color: "#0f172a",
              fontSize: "22px",
              fontWeight: 700,
              lineHeight: 1.3,
              margin: "0 0 12px",
            }}
          >
            Registro anulado
          </Heading>
          <Text style={{ color: "#475569", fontSize: "15px", lineHeight: 1.6 }}>
            Hola {firstName}: la administración de <strong>{complexName}</strong>{" "}
            no aprobó / anuló tu registro en la app.
          </Text>

          <Section
            style={{
              backgroundColor: "#fef2f2",
              borderRadius: "12px",
              margin: "20px 0",
              padding: "16px 18px",
            }}
          >
            <Text
              style={{
                color: "#991b1b",
                fontSize: "12px",
                fontWeight: 600,
                margin: "0 0 6px",
                textTransform: "uppercase",
              }}
            >
              Motivo
            </Text>
            <Text
              style={{
                color: "#7f1d1d",
                fontSize: "14px",
                lineHeight: 1.55,
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {reason}
            </Text>
          </Section>

          <Text style={{ color: "#475569", fontSize: "15px", lineHeight: 1.6 }}>
            Tu cuenta y datos de ese registro fueron eliminados. Para volver a
            entrar necesitas una{" "}
            <strong>nueva invitación</strong> de la administración y completar
            el registro de nuevo.
          </Text>

          <Hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

          <Text style={{ color: "#94a3b8", fontSize: "12px", lineHeight: 1.5 }}>
            ¿Crees que es un error? Contacta a la administración de{" "}
            {complexName} o escribe a {supportEmail}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default RegistrationDeniedEmail;
