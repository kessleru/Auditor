// Launcher do Auditoria RF para quem não usa Docker no dia a dia.
//
// Compila com o csc do .NET Framework, que já vem no Windows (ver build.ps1) — não exige instalar
// nada além do Docker Desktop. As cores e a tipografia seguem os tokens da seção 4 do plano.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace AuditoriaRf
{
    static class Tokens
    {
        public static readonly Color Canvas = ColorTranslator.FromHtml("#F7F6F3");
        public static readonly Color Surface = ColorTranslator.FromHtml("#FFFFFF");
        public static readonly Color Muted = ColorTranslator.FromHtml("#F0EEEA");
        public static readonly Color Border = ColorTranslator.FromHtml("#E6E3DE");
        public static readonly Color Text = ColorTranslator.FromHtml("#21211F");
        public static readonly Color TextMuted = ColorTranslator.FromHtml("#5C5C57");
        public static readonly Color Accent = ColorTranslator.FromHtml("#1F4FA8");
        public static readonly Color AccentDeep = ColorTranslator.FromHtml("#0F2C66");
        public static readonly Color AccentLight = ColorTranslator.FromHtml("#9FC2FF");
        public static readonly Color Ok = ColorTranslator.FromHtml("#1B7A55");
        public static readonly Color Critical = ColorTranslator.FromHtml("#B3261E");

        public static readonly Font Title = new Font("Segoe UI Semibold", 20f);
        public static readonly Font Subtitle = new Font("Segoe UI", 9.75f);
        public static readonly Font Body = new Font("Segoe UI", 10f);
        public static readonly Font Label = new Font("Segoe UI", 9f);
        public static readonly Font ButtonFont = new Font("Segoe UI Semibold", 10f);
    }

    enum EstadoEtapa { Pendente, Andamento, Concluida, Falhou }

    /// <summary>Uma etapa da inicialização, com o círculo de estado à esquerda.</summary>
    class Etapa : Control
    {
        private EstadoEtapa estado = EstadoEtapa.Pendente;
        private string detalhe = "";
        private int angulo;
        private readonly System.Windows.Forms.Timer giro = new System.Windows.Forms.Timer { Interval = 60 };

        public string Titulo { get; set; }

        public Etapa(string titulo)
        {
            Titulo = titulo;
            Height = 46;
            DoubleBuffered = true;
            SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true);
            giro.Tick += delegate { angulo = (angulo + 30) % 360; Invalidate(); };
        }

        public void Definir(EstadoEtapa novo, string texto)
        {
            estado = novo;
            detalhe = texto ?? "";
            if (novo == EstadoEtapa.Andamento) giro.Start(); else giro.Stop();
            AccessibleName = Titulo + ": " + Rotulo();
            Invalidate();
        }

        private string Rotulo()
        {
            switch (estado)
            {
                case EstadoEtapa.Andamento: return "em andamento";
                case EstadoEtapa.Concluida: return "concluída";
                case EstadoEtapa.Falhou: return "falhou";
                default: return "aguardando";
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            Rectangle circulo = new Rectangle(2, Height / 2 - 11, 22, 22);
            using (Pen fundo = new Pen(Tokens.Border, 2.4f)) g.DrawEllipse(fundo, circulo);

            if (estado == EstadoEtapa.Andamento)
            {
                using (Pen p = new Pen(Tokens.Accent, 2.4f)) { p.StartCap = LineCap.Round; p.EndCap = LineCap.Round; g.DrawArc(p, circulo, angulo, 110); }
            }
            else if (estado == EstadoEtapa.Concluida)
            {
                using (Brush b = new SolidBrush(Tokens.Ok)) g.FillEllipse(b, circulo);
                using (Pen p = new Pen(Color.White, 2.4f))
                {
                    p.StartCap = LineCap.Round; p.EndCap = LineCap.Round;
                    g.DrawLines(p, new Point[] {
                        new Point(circulo.Left + 6, circulo.Top + 11),
                        new Point(circulo.Left + 9, circulo.Top + 15),
                        new Point(circulo.Left + 16, circulo.Top + 7) });
                }
            }
            else if (estado == EstadoEtapa.Falhou)
            {
                using (Brush b = new SolidBrush(Tokens.Critical)) g.FillEllipse(b, circulo);
                using (Pen p = new Pen(Color.White, 2.4f))
                {
                    p.StartCap = LineCap.Round; p.EndCap = LineCap.Round;
                    g.DrawLine(p, circulo.Left + 7, circulo.Top + 7, circulo.Right - 7, circulo.Bottom - 7);
                    g.DrawLine(p, circulo.Right - 7, circulo.Top + 7, circulo.Left + 7, circulo.Bottom - 7);
                }
            }

            Color corTitulo = estado == EstadoEtapa.Pendente ? Tokens.TextMuted : Tokens.Text;
            TextRenderer.DrawText(g, Titulo, Tokens.Body, new Point(38, 4), corTitulo);
            if (detalhe.Length > 0)
                TextRenderer.DrawText(g, detalhe, Tokens.Label, new Rectangle(38, 24, Width - 46, 18),
                    estado == EstadoEtapa.Falhou ? Tokens.Critical : Tokens.TextMuted,
                    TextFormatFlags.EndEllipsis);
        }
    }

    /// <summary>Botão chapado, com cantos arredondados e anel de foco sempre visível.</summary>
    class Botao : Button
    {
        public bool Primario { get; set; }
        private bool sobre;

        public Botao(string texto, bool primario)
        {
            Text = texto;
            Primario = primario;
            Height = 42;
            FlatStyle = FlatStyle.Flat;
            FlatAppearance.BorderSize = 0;
            BackColor = Tokens.Canvas;
            Font = Tokens.ButtonFont;
            Cursor = Cursors.Hand;
            SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint, true);
            MouseEnter += delegate { sobre = true; Invalidate(); };
            MouseLeave += delegate { sobre = false; Invalidate(); };
            GotFocus += delegate { Invalidate(); };
            LostFocus += delegate { Invalidate(); };
        }

        private static GraphicsPath Arredondado(Rectangle r, int raio)
        {
            GraphicsPath caminho = new GraphicsPath();
            caminho.AddArc(r.X, r.Y, raio, raio, 180, 90);
            caminho.AddArc(r.Right - raio, r.Y, raio, raio, 270, 90);
            caminho.AddArc(r.Right - raio, r.Bottom - raio, raio, raio, 0, 90);
            caminho.AddArc(r.X, r.Bottom - raio, raio, raio, 90, 90);
            caminho.CloseFigure();
            return caminho;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Parent != null ? Parent.BackColor : Tokens.Canvas);

            Rectangle corpo = new Rectangle(2, 2, Width - 5, Height - 5);
            Color fundo, texto;
            if (!Enabled) { fundo = Tokens.Muted; texto = Tokens.TextMuted; }
            else if (Primario) { fundo = sobre ? Tokens.AccentDeep : Tokens.Accent; texto = Color.White; }
            else { fundo = sobre ? Tokens.Muted : Tokens.Surface; texto = Tokens.Text; }

            using (GraphicsPath caminho = Arredondado(corpo, 10))
            {
                using (Brush b = new SolidBrush(fundo)) g.FillPath(b, caminho);
                if (!Primario && Enabled)
                    using (Pen p = new Pen(ColorTranslator.FromHtml("#8C877F"), 1f)) g.DrawPath(p, caminho);
            }

            if (Focused && Enabled)
                using (GraphicsPath anel = Arredondado(new Rectangle(0, 0, Width - 1, Height - 1), 12))
                using (Pen p = new Pen(Tokens.Accent, 2f)) g.DrawPath(p, anel);

            TextRenderer.DrawText(g, Text, Font, corpo, texto,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }

    /// <summary>Faixa da marca no topo: gradiente, símbolo e nome.</summary>
    class Cabecalho : Control
    {
        public Cabecalho()
        {
            Height = 132;
            Dock = DockStyle.Top;
            DoubleBuffered = true;
            SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint, true);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            using (LinearGradientBrush fundo = new LinearGradientBrush(ClientRectangle, Tokens.Accent, Tokens.AccentDeep, 35f))
                g.FillRectangle(fundo, ClientRectangle);

            // Símbolo: o "A" cuja barra é um sinal de verificação, dentro do anel do foco.
            Rectangle marca = new Rectangle(28, 30, 72, 72);
            using (Brush b = new SolidBrush(Color.FromArgb(28, 255, 255, 255))) g.FillEllipse(b, marca);
            using (Pen p = new Pen(Tokens.AccentLight, 2f)) g.DrawEllipse(p, marca);
            using (Pen p = new Pen(Color.White, 6f))
            {
                p.StartCap = LineCap.Round; p.EndCap = LineCap.Round; p.LineJoin = LineJoin.Round;
                g.DrawLines(p, new Point[] { new Point(marca.Left + 18, marca.Bottom - 18),
                    new Point(marca.Left + 36, marca.Top + 16), new Point(marca.Right - 18, marca.Bottom - 18) });
            }
            using (Pen p = new Pen(ColorTranslator.FromHtml("#7FE0B6"), 6f))
            {
                p.StartCap = LineCap.Round; p.EndCap = LineCap.Round; p.LineJoin = LineJoin.Round;
                g.DrawLines(p, new Point[] { new Point(marca.Left + 24, marca.Top + 42),
                    new Point(marca.Left + 32, marca.Top + 50), new Point(marca.Right - 24, marca.Top + 30) });
            }

            TextRenderer.DrawText(g, "Auditoria RF", Tokens.Title, new Point(118, 42), Color.White);
            TextRenderer.DrawText(g, "Acessibilidade e usabilidade dos portais da Rede Federal",
                Tokens.Subtitle, new Point(120, 78), ColorTranslator.FromHtml("#DCE6F9"));
        }
    }

    class Janela : Form
    {
        private readonly Etapa etapaDocker = new Etapa("Docker Desktop");
        private readonly Etapa etapaImagens = new Etapa("Preparar a aplicação");
        private readonly Etapa etapaServicos = new Etapa("Subir o sistema");
        private readonly Etapa etapaPronto = new Etapa("Abrir no navegador");
        private readonly Label mensagem = new Label();
        private readonly Botao abrir = new Botao("Abrir o sistema", true);
        private readonly Botao parar = new Botao("Parar", false);
        private readonly Botao auditor = new Botao("Criar auditor", false);
        private readonly LinkLabel detalhes = new LinkLabel();
        private readonly LinkLabel log = new LinkLabel();

        private readonly string pastaDocker;
        private const string Endereco = "http://localhost:8080";
        private string ultimoErro = "";

        /// <summary>Log de tudo o que o launcher faz, para diagnóstico depois do fato.</summary>
        private static readonly string ArquivoLog = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AuditoriaRF", "launcher.log");

        private static void Registrar(string texto)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(ArquivoLog));
                File.AppendAllText(ArquivoLog,
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + texto + Environment.NewLine);
            }
            catch { /* log é conveniência: se não der para gravar, o programa segue. */ }
        }

        public Janela(string pastaDocker)
        {
            this.pastaDocker = pastaDocker;

            Text = "Auditoria RF";
            BackColor = Tokens.Canvas;
            ClientSize = new Size(620, 500);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            Font = Tokens.Body;

            Controls.Add(new Cabecalho());

            Panel corpo = new Panel { Dock = DockStyle.Fill, Padding = new Padding(28, 24, 28, 20), BackColor = Tokens.Canvas };
            Controls.Add(corpo);
            corpo.BringToFront();

            Panel cartao = new Panel { Dock = DockStyle.Top, Height = 206, BackColor = Tokens.Surface, Padding = new Padding(18, 14, 18, 14) };
            cartao.Paint += delegate (object s, PaintEventArgs e)
            {
                using (Pen p = new Pen(Tokens.Border)) e.Graphics.DrawRectangle(p, 0, 0, cartao.Width - 1, cartao.Height - 1);
            };
            corpo.Controls.Add(cartao);

            Etapa[] etapas = { etapaPronto, etapaServicos, etapaImagens, etapaDocker };
            foreach (Etapa etapa in etapas)
            {
                etapa.Dock = DockStyle.Top;
                etapa.Width = cartao.Width;
                cartao.Controls.Add(etapa);
            }

            mensagem.Dock = DockStyle.Top;
            mensagem.Height = 58;
            mensagem.Padding = new Padding(0, 16, 0, 0);
            mensagem.ForeColor = Tokens.TextMuted;
            mensagem.Font = Tokens.Label;
            mensagem.Text = "Preparando tudo. A primeira vez demora alguns minutos, porque a aplicação é montada na sua máquina.";
            corpo.Controls.Add(mensagem);
            mensagem.BringToFront();

            log.Dock = DockStyle.Bottom;
            log.Height = 22;
            log.Font = Tokens.Label;
            log.LinkColor = Tokens.Accent;
            log.Text = "Abrir o log do launcher";
            log.LinkClicked += delegate
            {
                try
                {
                    if (!File.Exists(ArquivoLog)) Registrar("log aberto pelo usuário");
                    Process.Start("notepad.exe", ArquivoLog);
                }
                catch { }
            };
            corpo.Controls.Add(log);

            detalhes.Dock = DockStyle.Bottom;
            detalhes.Height = 24;
            detalhes.Font = Tokens.Label;
            detalhes.LinkColor = Tokens.Accent;
            detalhes.Visible = false;
            detalhes.Text = "Ver detalhes do erro";
            detalhes.LinkClicked += delegate { MostrarErro(); };
            corpo.Controls.Add(detalhes);

            FlowLayoutPanel acoes = new FlowLayoutPanel
            {
                Dock = DockStyle.Bottom,
                Height = 58,
                FlowDirection = FlowDirection.RightToLeft,
                BackColor = Tokens.Canvas,
            };
            abrir.Width = 180;
            abrir.Enabled = false;
            abrir.Click += delegate { Process.Start(Endereco); };
            parar.Width = 110;
            parar.Enabled = false;
            parar.Click += delegate { Parar(); };
            auditor.Width = 150;
            auditor.Enabled = false;
            auditor.Click += delegate { CriarAuditor(); };
            acoes.Controls.Add(abrir);
            acoes.Controls.Add(auditor);
            acoes.Controls.Add(parar);
            corpo.Controls.Add(acoes);

            foreach (Etapa etapa in etapas) etapa.Definir(EstadoEtapa.Pendente, "");
            Shown += delegate { Task.Factory.StartNew(() => Iniciar()); };
        }

        private void NaTela(Action acao)
        {
            if (InvokeRequired) BeginInvoke(acao); else acao();
        }

        private void Dizer(string texto)
        {
            Registrar(texto);
            NaTela(delegate { mensagem.Text = texto; });
        }

        private void Falhar(Etapa etapa, string resumo, string erro)
        {
            ultimoErro = erro ?? "";
            Registrar("FALHA: " + resumo);
            NaTela(delegate
            {
                etapa.Definir(EstadoEtapa.Falhou, resumo);
                mensagem.ForeColor = Tokens.Critical;
                mensagem.Text = resumo;
                detalhes.Visible = ultimoErro.Length > 0;
            });
        }

        /// <summary>
        /// Cria a conta do auditor pela CLI de dentro do contêiner. Não há cadastro público (seção 7
        /// do plano), e sem conta ninguém registra auditoria — daí o botão aqui.
        /// </summary>
        private void CriarAuditor()
        {
            Form dialogo = new Form
            {
                Text = "Criar auditor",
                ClientSize = new Size(440, 330),
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                StartPosition = FormStartPosition.CenterParent,
                BackColor = Tokens.Canvas,
                Font = Tokens.Body,
                Padding = new Padding(24, 20, 24, 16),
            };

            Label explicacao = new Label
            {
                Dock = DockStyle.Top,
                Height = 46,
                Font = Tokens.Label,
                ForeColor = Tokens.TextMuted,
                Text = "O sistema não tem cadastro público: a conta do auditor é criada aqui. "
                     + "A senha precisa de pelo menos 12 caracteres.",
            };

            Label aviso = new Label
            {
                Dock = DockStyle.Bottom,
                Height = 44,
                Font = Tokens.Label,
                ForeColor = Tokens.Critical,
                Text = "",
            };

            TextBox nome = new TextBox { Dock = DockStyle.Top, AccessibleName = "Nome" };
            TextBox email = new TextBox { Dock = DockStyle.Top, AccessibleName = "E-mail" };
            TextBox senha = new TextBox { Dock = DockStyle.Top, UseSystemPasswordChar = true, AccessibleName = "Senha" };

            Func<string, Label> rotulo = delegate (string texto)
            {
                return new Label { Dock = DockStyle.Top, Height = 22, Text = texto, Font = Tokens.Label, ForeColor = Tokens.Text };
            };

            Botao criar = new Botao("Criar conta", true) { Width = 150, Margin = new Padding(0, 6, 0, 0) };
            FlowLayoutPanel acoes = new FlowLayoutPanel
            {
                Dock = DockStyle.Bottom,
                Height = 54,
                FlowDirection = FlowDirection.RightToLeft,
                BackColor = Tokens.Canvas,
            };
            acoes.Controls.Add(criar);

            criar.Click += delegate
            {
                aviso.ForeColor = Tokens.Critical;
                if (nome.Text.Trim().Length == 0 || email.Text.Trim().Length == 0)
                {
                    aviso.Text = "Preencha o nome e o e-mail.";
                    return;
                }
                if (senha.Text.Length < 12)
                {
                    aviso.Text = "A senha precisa de pelo menos 12 caracteres.";
                    return;
                }

                criar.Enabled = false;
                aviso.ForeColor = Tokens.TextMuted;
                aviso.Text = "Criando a conta…";
                string argumentos = "compose exec -T api node apps/api/dist/cli/create-auditor.js"
                    + " --email \"" + email.Text.Trim() + "\" --name \"" + nome.Text.Trim() + "\"";
                string segredo = senha.Text;

                Task.Factory.StartNew(delegate
                {
                    Saida saida = Rodar("docker", argumentos, 120, segredo);
                    NaTela(delegate
                    {
                        criar.Enabled = true;
                        if (saida.Codigo == 0)
                        {
                            aviso.ForeColor = Tokens.Ok;
                            aviso.Text = "Conta criada. Já dá para entrar no sistema.";
                            senha.Clear();
                        }
                        else
                        {
                            aviso.ForeColor = Tokens.Critical;
                            string texto = (saida.Texto ?? "").Trim();
                            int corte = texto.LastIndexOf("Erro:", StringComparison.Ordinal);
                            aviso.Text = corte >= 0 ? texto.Substring(corte) : "Não foi possível criar a conta.";
                            ultimoErro = texto;
                            detalhes.Visible = true;
                        }
                    });
                });
            };

            // Os controles com Dock = Top entram de baixo para cima.
            dialogo.Controls.Add(aviso);
            dialogo.Controls.Add(acoes);
            dialogo.Controls.Add(senha);
            dialogo.Controls.Add(rotulo("Senha"));
            dialogo.Controls.Add(email);
            dialogo.Controls.Add(rotulo("E-mail"));
            dialogo.Controls.Add(nome);
            dialogo.Controls.Add(rotulo("Nome"));
            dialogo.Controls.Add(explicacao);
            dialogo.AcceptButton = criar;
            dialogo.ShowDialog(this);
        }

        private void MostrarErro()
        {
            Form dialogo = new Form
            {
                Text = "Detalhes do erro",
                ClientSize = new Size(640, 380),
                StartPosition = FormStartPosition.CenterParent,
                BackColor = Tokens.Surface,
            };
            TextBox caixa = new TextBox
            {
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                Dock = DockStyle.Fill,
                Font = new Font("Consolas", 9f),
                Text = ultimoErro,
                BorderStyle = BorderStyle.None,
                BackColor = Tokens.Surface,
            };
            dialogo.Controls.Add(caixa);
            dialogo.ShowDialog(this);
        }

        // ---- Execução do Docker -------------------------------------------------------------

        private class Saida { public int Codigo; public string Texto; }

        private Saida Rodar(string arquivo, string argumentos, int segundos)
        {
            return Rodar(arquivo, argumentos, segundos, null);
        }

        /// <summary>Roda um comando; <paramref name="entrada"/> vai pela entrada padrão (senhas).</summary>
        private Saida Rodar(string arquivo, string argumentos, int segundos, string entrada)
        {
            ProcessStartInfo info = new ProcessStartInfo(arquivo, argumentos)
            {
                WorkingDirectory = pastaDocker,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                RedirectStandardInput = entrada != null,
            };
            using (Process processo = new Process())
            {
                processo.StartInfo = info;

                // As duas saídas são lidas em paralelo, por evento. Lendo uma de cada vez com
                // ReadToEnd, o `docker compose`, que escreve o progresso na saída de erro, enche o
                // buffer e trava: ele espera alguém ler, nós esperamos ele terminar.
                System.Text.StringBuilder texto = new System.Text.StringBuilder();
                DataReceivedEventHandler juntar = delegate (object s, DataReceivedEventArgs e)
                {
                    if (e.Data == null) return;
                    lock (texto) texto.AppendLine(e.Data);
                };
                processo.OutputDataReceived += juntar;
                processo.ErrorDataReceived += juntar;

                Registrar("$ " + arquivo + " " + argumentos);
                processo.Start();
                processo.BeginOutputReadLine();
                processo.BeginErrorReadLine();

                if (entrada != null)
                {
                    processo.StandardInput.WriteLine(entrada);
                    processo.StandardInput.Close();
                }

                if (!processo.WaitForExit(segundos * 1000))
                {
                    try { processo.Kill(); } catch { }
                    lock (texto) return new Saida { Codigo = -1, Texto = texto + "\r\n(tempo esgotado)" };
                }
                // Sem argumento, WaitForExit também espera o fim da leitura das duas saídas.
                processo.WaitForExit();
                lock (texto)
                {
                    string resultado = texto.ToString();
                    Registrar("saiu com código " + processo.ExitCode +
                        (resultado.Trim().Length > 0 ? Environment.NewLine + resultado.TrimEnd() : ""));
                    return new Saida { Codigo = processo.ExitCode, Texto = resultado };
                }
            }
        }

        private bool ApiNoAr()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(Endereco + "/api/v1/health");
                req.Timeout = 3000;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                    return res.StatusCode == HttpStatusCode.OK;
            }
            catch { return false; }
        }

        private void Iniciar()
        {
            Registrar("=== launcher iniciado em " + pastaDocker + " ===");
            // 1. Docker instalado e ligado.
            NaTela(delegate { etapaDocker.Definir(EstadoEtapa.Andamento, "procurando o Docker"); });
            Saida versao = Rodar("docker", "--version", 20);
            if (versao.Codigo != 0)
            {
                Falhar(etapaDocker, "O Docker Desktop não está instalado nesta máquina.",
                    "Instale em https://www.docker.com/products/docker-desktop/ e abra este programa de novo.\r\n\r\n" + versao.Texto);
                return;
            }

            if (Rodar("docker", "info", 25).Codigo != 0)
            {
                NaTela(delegate { etapaDocker.Definir(EstadoEtapa.Andamento, "iniciando o Docker Desktop"); });
                Dizer("O Docker Desktop está sendo iniciado. Isso costuma levar um minuto.");
                string caminho = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                    "Docker", "Docker", "Docker Desktop.exe");
                if (File.Exists(caminho)) { try { Process.Start(caminho); } catch { } }

                bool ligou = false;
                for (int i = 0; i < 40 && !ligou; i++)
                {
                    Thread.Sleep(3000);
                    ligou = Rodar("docker", "info", 20).Codigo == 0;
                }
                if (!ligou)
                {
                    Falhar(etapaDocker, "O Docker Desktop não respondeu a tempo.",
                        "Abra o Docker Desktop manualmente, espere ele terminar de iniciar e rode este programa de novo.");
                    return;
                }
            }
            NaTela(delegate { etapaDocker.Definir(EstadoEtapa.Concluida, "pronto"); });

            // 2. Imagens.
            NaTela(delegate { etapaImagens.Definir(EstadoEtapa.Andamento, "montando a aplicação (primeira vez demora)"); });
            Dizer("Montando a aplicação. Na primeira vez isso leva alguns minutos; nas próximas é quase instantâneo.");
            Saida build = Rodar("docker", "compose build", 60 * 25);
            if (build.Codigo != 0)
            {
                Falhar(etapaImagens, "Não foi possível montar a aplicação.", build.Texto);
                return;
            }
            NaTela(delegate { etapaImagens.Definir(EstadoEtapa.Concluida, "pronto"); });

            // 3. Subir os serviços.
            NaTela(delegate { etapaServicos.Definir(EstadoEtapa.Andamento, "subindo API e front"); });
            Saida up = Rodar("docker", "compose up -d", 60 * 10);
            if (up.Codigo != 0)
            {
                Falhar(etapaServicos, "Não foi possível subir o sistema.", up.Texto);
                return;
            }

            // Primeira execução: banco vazio ganha as tabelas e os dados iniciais.
            Rodar("docker", "compose exec -T api node apps/api/dist/cli/db-seed.js", 180);
            NaTela(delegate { etapaServicos.Definir(EstadoEtapa.Concluida, "no ar"); });

            // 4. Esperar responder.
            NaTela(delegate { etapaPronto.Definir(EstadoEtapa.Andamento, "aguardando resposta"); });
            bool respondeu = false;
            for (int i = 0; i < 40 && !respondeu; i++)
            {
                Thread.Sleep(1500);
                respondeu = ApiNoAr();
            }
            if (!respondeu)
            {
                Falhar(etapaPronto, "O sistema subiu, mas não respondeu a tempo.",
                    Rodar("docker", "compose logs --tail 60", 60).Texto);
                return;
            }

            NaTela(delegate
            {
                etapaPronto.Definir(EstadoEtapa.Concluida, Endereco);
                mensagem.ForeColor = Tokens.TextMuted;
                mensagem.Text = "Tudo pronto. Os resultados são públicos; para registrar auditorias é preciso entrar como auditor.";
                abrir.Enabled = true;
                parar.Enabled = true;
                auditor.Enabled = true;
                abrir.Focus();
            });
            try { Process.Start(Endereco); } catch { }
        }

        private void Parar()
        {
            parar.Enabled = false;
            abrir.Enabled = false;
            auditor.Enabled = false;
            Dizer("Parando o sistema…");
            Task.Factory.StartNew(delegate
            {
                Rodar("docker", "compose stop", 180);
                NaTela(delegate
                {
                    etapaServicos.Definir(EstadoEtapa.Pendente, "parado");
                    etapaPronto.Definir(EstadoEtapa.Pendente, "");
                    mensagem.Text = "Sistema parado. Feche a janela ou abra o programa de novo para subir outra vez.";
                });
            });
        }
    }

    static class Programa
    {
        /// <summary>Procura a pasta docker/ subindo a partir do executável.</summary>
        private static string AcharPastaDocker()
        {
            DirectoryInfo dir = new DirectoryInfo(
                Path.GetDirectoryName(Application.ExecutablePath));
            for (int i = 0; i < 5 && dir != null; i++, dir = dir.Parent)
            {
                string candidata = Path.Combine(dir.FullName, "docker");
                if (File.Exists(Path.Combine(candidata, "docker-compose.yml"))) return candidata;
                if (File.Exists(Path.Combine(dir.FullName, "docker-compose.yml"))) return dir.FullName;
            }
            return null;
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string pasta = AcharPastaDocker();
            if (pasta == null)
            {
                MessageBox.Show(
                    "Não encontrei o arquivo docker-compose.yml. Deixe este programa dentro da pasta do projeto, " +
                    "ao lado da pasta docker.",
                    "Auditoria RF", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            Application.Run(new Janela(pasta));
        }
    }
}
