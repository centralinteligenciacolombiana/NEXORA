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
} from "@react-email/components";

export type InviteEmailRole = "RESIDENT" | "SECURITY" | "STAFF" | "ADMIN";

export interface InviteEmailProps {
  userName: string;
  complexName: string;
  role: InviteEmailRole;
  inviteUrl: string;
  supportEmail?: string;
}

const ROLE_LABEL: Record<InviteEmailRole, string> = {
  RESIDENT: "Residente",
  SECURITY: "Seguridad",
  STAFF: "Personal",
  ADMIN: "Administrador",
};

export function InviteEmail({
  userName,
  complexName,
  role,
  inviteUrl,
  supportEmail = "soporte@nexora.app",
}: InviteEmailProps) {
  const firstName = userName.trim().split(/\s+/)[0] || "hola";
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <Html lang="es">
      <Head />
      <Preview>
        Confirma tu correo y únete a {complexName} en NEXORA
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
          {/* Encabezado */}
          <Section style={{ textAlign: "center" }}>
            <Heading
              as="h1"
              style={{
                color: "#4F46E5",
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              NEXORA
            </Heading>
            <Text
              style={{
                color: "#64748b",
                fontSize: "13px",
                lineHeight: "20px",
                margin: "8px 0 0",
              }}
            >
              Conectamos personas, facilitamos la convivencia
            </Text>
          </Section>

          <Hr
            style={{
              borderColor: "#e2e8f0",
              borderTop: "1px solid #e2e8f0",
              margin: "28px 0",
            }}
          />

          {/* Cuerpo */}
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
              Hola, {firstName}
            </Heading>
            <Text
              style={{
                color: "#475569",
                fontSize: "15px",
                lineHeight: "24px",
                margin: "0 0 16px",
              }}
            >
              Has sido invitado/a a unirte a{" "}
              <strong style={{ color: "#0f172a" }}>{complexName}</strong> en
              NEXORA como{" "}
              <strong style={{ color: "#4F46E5" }}>{roleLabel}</strong> (
              {role}).
            </Text>
            <Text
              style={{
                color: "#475569",
                fontSize: "15px",
                lineHeight: "24px",
                margin: "0 0 28px",
              }}
            >
              Confirma tu correo electrónico para activar tu cuenta y acceder al
              panel de tu conjunto residencial.
            </Text>
          </Section>

          {/* CTA */}
          <Section style={{ textAlign: "center" }}>
            <Button
              href={inviteUrl}
              style={{
                backgroundColor: "#4F46E5",
                borderRadius: "10px",
                color: "#ffffff",
                display: "inline-block",
                fontSize: "15px",
                fontWeight: 600,
                padding: "14px 28px",
                textDecoration: "none",
              }}
            >
              Confirmar Correo y Unirme a Mi Conjunto
            </Button>
          </Section>

          <Section style={{ marginTop: "24px" }}>
            <Text
              style={{
                color: "#94a3b8",
                fontSize: "12px",
                lineHeight: "18px",
                margin: 0,
              }}
            >
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </Text>
            <Link
              href={inviteUrl}
              style={{
                color: "#4F46E5",
                display: "block",
                fontSize: "12px",
                lineHeight: "18px",
                marginTop: "8px",
                wordBreak: "break-all",
              }}
            >
              {inviteUrl}
            </Link>
          </Section>

          <Hr
            style={{
              borderColor: "#e2e8f0",
              borderTop: "1px solid #e2e8f0",
              margin: "32px 0 20px",
            }}
          />

          {/* Pie */}
          <Section style={{ textAlign: "center" }}>
            <Text
              style={{
                color: "#4F46E5",
                fontSize: "13px",
                fontWeight: 600,
                margin: "0 0 8px",
              }}
            >
              Tu conjunto residencial en un solo lugar
            </Text>
            <Text
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                lineHeight: "17px",
                margin: "0 0 8px",
              }}
            >
              Este mensaje es confidencial y está dirigido únicamente a la
              persona destinataria. Si lo recibiste por error, ignóralo o
              elimínalo.
            </Text>
            <Text
              style={{
                color: "#94a3b8",
                fontSize: "11px",
                lineHeight: "17px",
                margin: 0,
              }}
            >
              ¿Necesitas ayuda?{" "}
              <Link
                href={`mailto:${supportEmail}`}
                style={{ color: "#4F46E5", textDecoration: "underline" }}
              >
                Contactar soporte
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default InviteEmail;
