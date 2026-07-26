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

export interface TicketUpdatedEmailProps {
  userName: string;
  complexName: string;
  radicado: string;
  title: string;
  statusLabel: string;
  adminResponse?: string | null;
  ticketUrl: string;
  resolved?: boolean;
}

export function TicketUpdatedEmail({
  userName,
  complexName,
  radicado,
  title,
  statusLabel,
  adminResponse,
  ticketUrl,
  resolved = false,
}: TicketUpdatedEmailProps) {
  const firstName = userName.trim().split(/\s+/)[0] || "hola";

  return (
    <Html lang="es">
      <Head />
      <Preview>
        {resolved
          ? `Solución para ${radicado}: ${title}`
          : `Actualización ${radicado}: ${statusLabel}`}
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
              {resolved ? "Solución registrada" : "Actualización de tu solicitud"}
            </Heading>
            <Text style={{ color: "#334155", fontSize: "15px", lineHeight: 1.6 }}>
              Hola {firstName}, hay novedades en <strong>{radicado}</strong> —{" "}
              {title}.
            </Text>
            <Text style={{ color: "#0f172a", fontSize: "15px", margin: "12px 0" }}>
              <strong>Estado:</strong> {statusLabel}
            </Text>
            {adminResponse ? (
              <Text
                style={{
                  backgroundColor: "#f1f5f9",
                  borderRadius: "12px",
                  color: "#334155",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  margin: "0 0 20px",
                  padding: "14px 16px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {adminResponse}
              </Text>
            ) : null}
            <Section style={{ textAlign: "center" }}>
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
                Ver detalle
              </Button>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default TicketUpdatedEmail;
