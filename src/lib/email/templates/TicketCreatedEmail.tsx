import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface TicketCreatedEmailProps {
  userName: string;
  complexName: string;
  radicado: string;
  title: string;
  typeLabel: string;
  ticketUrl: string;
}

export function TicketCreatedEmail({
  userName,
  complexName,
  radicado,
  title,
  typeLabel,
  ticketUrl,
}: TicketCreatedEmailProps) {
  const firstName = userName.trim().split(/\s+/)[0] || "hola";

  return (
    <Html lang="es">
      <Head />
      <Preview>
        Radicado {radicado}: recibimos tu solicitud «{title}»
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
            boxShadow: "0 4px 24px rgba(15, 23, 42, 0.06)",
            margin: "0 auto",
            maxWidth: "560px",
            padding: "40px 32px",
          }}
        >
          <Section style={{ textAlign: "center" }}>
            <Heading
              as="h1"
              style={{
                color: "#4F46E5",
                fontSize: "28px",
                fontWeight: 700,
                margin: 0,
              }}
            >
              NEXORA
            </Heading>
            <Text style={{ color: "#64748b", fontSize: "13px", margin: "8px 0 0" }}>
              {complexName}
            </Text>
          </Section>
          <Hr style={{ borderColor: "#e2e8f0", margin: "28px 0" }} />
          <Section>
            <Heading
              as="h2"
              style={{
                color: "#0f172a",
                fontSize: "20px",
                fontWeight: 600,
                margin: "0 0 12px",
              }}
            >
              Solicitud recibida
            </Heading>
            <Text style={{ color: "#334155", fontSize: "15px", lineHeight: 1.6 }}>
              Hola {firstName}, registramos tu {typeLabel.toLowerCase()}:{" "}
              <strong>{title}</strong>.
            </Text>
            <Text
              style={{
                backgroundColor: "#eef2ff",
                borderRadius: "12px",
                color: "#4F46E5",
                fontFamily: "ui-monospace, monospace",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                margin: "20px 0",
                padding: "14px 16px",
                textAlign: "center",
              }}
            >
              {radicado}
            </Text>
            <Text style={{ color: "#64748b", fontSize: "14px" }}>
              Guarda este número de radicado para hacer seguimiento.
            </Text>
            <Section style={{ textAlign: "center", marginTop: "24px" }}>
              <Button
                href={ticketUrl}
                style={{
                  backgroundColor: "#4F46E5",
                  borderRadius: "10px",
                  color: "#ffffff",
                  display: "inline-block",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "12px 24px",
                  textDecoration: "none",
                }}
              >
                Ver seguimiento
              </Button>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default TicketCreatedEmail;
