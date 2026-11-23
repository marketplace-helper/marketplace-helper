import {
  createUser,
  findByEmail,
  verifyPassword,
  validatePassword,
  updateProfile,
  changePassword,
} from "../services/accountService.js";
import {
  sendVerificationEmail,
  verifyEmail,
  sendPasswordResetEmail,
  isResetTokenValid,
  resetPassword,
  requestEmailChange,
  cancelEmailChange,
  confirmEmailChange,
  EmailChangeError,
} from "../services/emailAuthService.js";
import { getAuthStatus } from "../services/mlAuth.js";
import { getMlProfile } from "../services/mlApi.js";

export function showLogin(req, res) {
  if (req.session?.userId) return res.redirect("/");
  res.render("login", {
    title: "Entrar",
    error: req.query.error || null,
    message: req.query.message || null,
    unverifiedEmail: null,
  });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await findByEmail(email);
  if (!user || !(await verifyPassword(user, password))) {
    return res.redirect("/login?error=" + encodeURIComponent("E-mail ou senha inválidos."));
  }
  // Senha correta, mas e-mail ainda não confirmado: não loga e oferece reenvio.
  if (!user.emailVerifiedAt) {
    return res.status(403).render("login", {
      title: "Entrar",
      error: "Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada (e no spam).",
      message: null,
      unverifiedEmail: user.email,
    });
  }
  req.session.userId = user.id;
  res.redirect("/");
}

export function showRegister(req, res) {
  if (req.session?.userId) return res.redirect("/");
  res.render("register", { title: "Criar conta", error: null, values: {} });
}

export async function register(req, res) {
  const { email, storeName, whatsapp, password, confirmPassword } = req.body;
  const values = { email, storeName, whatsapp };
  const fail = (error) =>
    res.status(400).render("register", { title: "Criar conta", error, values });

  if (!email || !storeName || !whatsapp || !password) return fail("Preencha todos os campos.");
  if (password !== confirmPassword) return fail("As senhas não conferem.");

  const pwError = validatePassword(password);
  if (pwError) return fail(pwError);

  if (await findByEmail(email)) return fail("Esse e-mail já está cadastrado.");

  try {
    const user = await createUser({ email, storeName, whatsapp, password });
    // Falha no envio não desfaz o cadastro: a tela seguinte permite reenviar.
    await sendVerificationEmail(user).catch((e) =>
      console.error("[register] e-mail de confirmação não enviado:", e.message)
    );
    res.redirect("/verifique-email?email=" + encodeURIComponent(user.email));
  } catch (e) {
    fail("Não foi possível criar a conta. Tente novamente.");
  }
}

// ===== Confirmação de e-mail =====
export function showCheckEmail(req, res) {
  res.render("check-email", {
    title: "Confirme seu e-mail",
    email: req.query.email || "",
    message: req.query.message || null,
  });
}

// Resposta sempre igual, exista ou não a conta, para não revelar e-mails cadastrados.
export async function resendVerification(req, res) {
  const email = (req.body.email || "").trim();
  const user = await findByEmail(email);
  if (user && !user.emailVerifiedAt) {
    await sendVerificationEmail(user).catch((e) =>
      console.error("[verify] reenvio falhou:", e.message)
    );
  }
  res.redirect(
    "/verifique-email?email=" + encodeURIComponent(email) +
      "&message=" + encodeURIComponent("Se a conta existir e ainda não estiver confirmada, enviamos um novo link. Pode levar alguns minutos.")
  );
}

export async function confirmEmail(req, res) {
  const ok = await verifyEmail(req.query.token);
  if (!ok) {
    return res.redirect(
      "/login?error=" + encodeURIComponent("Link de confirmação inválido ou expirado. Entre com seu e-mail e senha para receber um novo.")
    );
  }
  res.redirect("/login?message=" + encodeURIComponent("E-mail confirmado! Agora é só entrar."));
}

export function logout(req, res) {
  req.session = null;
  res.redirect("/login?message=" + encodeURIComponent("Você saiu da conta."));
}

// ===== Minha conta =====
export async function showAccount(req, res) {
  const status = await getAuthStatus(req.user.id);
  let mlProfile = null;
  if (status.authenticated) {
    try {
      mlProfile = await getMlProfile(req.user.id);
    } catch (_) {
      mlProfile = null;
    }
  }
  res.render("account", {
    title: "Minha Conta",
    message: req.query.message || null,
    error: req.query.error || null,
    authenticated: status.authenticated,
    mlProfile,
  });
}

export async function updateAccountProfile(req, res) {
  const { storeName, email, whatsapp } = req.body;
  if (!storeName || !email || !whatsapp) {
    return res.redirect("/conta?error=" + encodeURIComponent("Preencha nome da loja, e-mail e WhatsApp."));
  }
  try {
    await updateProfile(req.user.id, { storeName, whatsapp });
  } catch (e) {
    return res.redirect("/conta?error=" + encodeURIComponent("Não foi possível salvar."));
  }

  const newEmail = email.toLowerCase().trim();
  const emailChanged = newEmail !== req.user.email && newEmail !== req.user.pendingEmail;
  if (!emailChanged) {
    return res.redirect("/conta?message=" + encodeURIComponent("Dados atualizados com sucesso!"));
  }

  try {
    await requestEmailChange(req.user, newEmail);
    res.redirect(
      "/conta?message=" +
        encodeURIComponent(`Dados salvos. Enviamos um link para ${newEmail}: o e-mail da conta só muda depois que você confirmar.`)
    );
  } catch (e) {
    const msg = e instanceof EmailChangeError ? e.message : "Não foi possível enviar o e-mail de confirmação. Tente novamente.";
    if (!(e instanceof EmailChangeError)) console.error("[conta] troca de e-mail:", e.message);
    res.redirect("/conta?error=" + encodeURIComponent("Os outros dados foram salvos, mas o e-mail não mudou. " + msg));
  }
}

export async function cancelAccountEmailChange(req, res) {
  await cancelEmailChange(req.user.id);
  res.redirect("/conta?message=" + encodeURIComponent("Troca de e-mail cancelada."));
}

// Público: o link funciona mesmo sem estar logado (ex.: aberto no celular).
export async function confirmAccountEmailChange(req, res) {
  try {
    const email = await confirmEmailChange(req.query.token);
    const msg = `E-mail alterado para ${email}.`;
    if (req.session?.userId) return res.redirect("/conta?message=" + encodeURIComponent(msg));
    res.redirect("/login?message=" + encodeURIComponent(msg + " Entre com o novo endereço."));
  } catch (e) {
    if (!(e instanceof EmailChangeError)) throw e;
    const target = req.session?.userId ? "/conta" : "/login";
    res.redirect(target + "?error=" + encodeURIComponent(e.message));
  }
}

export async function updateAccountPassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!(await verifyPassword(req.user, currentPassword))) {
    return res.redirect("/conta?error=" + encodeURIComponent("Senha atual incorreta."));
  }
  if (newPassword !== confirmPassword) {
    return res.redirect("/conta?error=" + encodeURIComponent("A nova senha e a confirmação não conferem."));
  }
  const pwError = validatePassword(newPassword);
  if (pwError) {
    return res.redirect("/conta?error=" + encodeURIComponent(pwError));
  }
  await changePassword(req.user.id, newPassword);
  res.redirect("/conta?message=" + encodeURIComponent("Senha alterada com sucesso!"));
}

// ===== Recuperação de senha =====
export function showForgot(req, res) {
  if (req.session?.userId) return res.redirect("/");
  res.render("forgot", { title: "Recuperar senha", sent: false, email: "" });
}

// Resposta sempre igual, exista ou não a conta, para não revelar e-mails cadastrados.
export async function submitForgot(req, res) {
  const email = (req.body.email || "").trim();
  const user = await findByEmail(email);
  if (user) {
    await sendPasswordResetEmail(user).catch((e) =>
      console.error("[forgot] e-mail de recuperação não enviado:", e.message)
    );
  }
  res.render("forgot", { title: "Recuperar senha", sent: true, email });
}

export async function showResetPassword(req, res) {
  const token = req.query.token || "";
  const valid = await isResetTokenValid(token);
  res.render("reset-password", {
    title: "Nova senha",
    token,
    error: valid ? null : "Link inválido ou expirado. Peça um novo na tela de recuperação de senha.",
    invalidLink: !valid,
  });
}

export async function submitResetPassword(req, res) {
  const { token, newPassword, confirmPassword } = req.body;
  const fail = (error, invalidLink = false) =>
    res.status(400).render("reset-password", { title: "Nova senha", token, error, invalidLink });

  if (newPassword !== confirmPassword) return fail("A nova senha e a confirmação não conferem.");
  const pwError = validatePassword(newPassword);
  if (pwError) return fail(pwError);

  if (!(await resetPassword(token, newPassword))) {
    return fail("Link inválido ou expirado. Peça um novo na tela de recuperação de senha.", true);
  }
  res.redirect("/login?message=" + encodeURIComponent("Senha redefinida! Entre com a nova senha."));
}
