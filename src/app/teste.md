Para implementar **"Esqueci a senha"** no Spring (com Spring Boot e Spring Security), você precisará:

### **1. Componentes Necessários**
- **Endpoint para solicitar redefinição** (`POST /forgot-password`)
- **Geração de um token único** (com expiração)
- **Armazenamento temporário do token** (ex: banco de dados ou cache)
- **E-mail de recuperação** (com link contendo o token)
- **Endpoint para redefinir senha** (`POST /reset-password?token=...`)
- **Validação do token e atualização da senha**

---

### **2. Passo a Passo**

#### **2.1. Configurar Dependências (pom.xml)**
```xml
<!-- Spring Mail (para enviar e-mail) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>

<!-- Spring Data JPA (para salvar tokens) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
```

#### **2.2. Criar Entidade para o Token de Redefinição**
```java
@Entity
public class PasswordResetToken {
    @Id
    private String token;
    
    @OneToOne
    private User user; // Associa ao usuário
    
    private LocalDateTime expiryDate; // Tempo de expiração (ex: 24h)
}
```

#### **2.3. Criar o Repositório**
```java
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, String> {
    Optional<PasswordResetToken> findByToken(String token);
}
```

#### **2.4. Criar o Serviço de Redefinição**
```java
@Service
@RequiredArgsConstructor
public class PasswordResetService {
    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;

    public void generateResetToken(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado"));

        String token = UUID.randomUUID().toString();
        PasswordResetToken resetToken = new PasswordResetToken(
            token, 
            user, 
            LocalDateTime.now().plusHours(24)
        );
        tokenRepository.save(resetToken);

        // Envia e-mail com o link de redefinição
        String resetLink = "http://seusite.com/reset-password?token=" + token;
        mailSender.send(
            SimpleMailMessage()
                .setTo(user.getEmail())
                .setSubject("Redefinição de Senha")
                .setText("Clique no link para redefinir: " + resetLink)
        );
    }

    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Token inválido"));

        if (resetToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Token expirado");
        }

        User user = resetToken.getUser();
        user.setPassword(new BCryptPasswordEncoder().encode(newPassword));
        userRepository.save(user);
        tokenRepository.delete(resetToken); // Remove o token após uso
    }
}
```

#### **2.5. Criar os Endpoints**
```java
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class PasswordResetController {
    private final PasswordResetService passwordResetService;

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestParam String email) {
        passwordResetService.generateResetToken(email);
        return ResponseEntity.ok("E-mail de redefinição enviado");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(
        @RequestParam String token,
        @RequestParam String newPassword
    ) {
        passwordResetService.resetPassword(token, newPassword);
        return ResponseEntity.ok("Senha redefinida com sucesso");
    }
}
```

---

### **3. Configurações Adicionais**
- **Configurar `application.properties` para envio de e-mail**:
  ```properties
  spring.mail.host=smtp.gmail.com
  spring.mail.port=587
  spring.mail.username=seu-email@gmail.com
  spring.mail.password=sua-senha
  spring.mail.properties.mail.smtp.auth=true
  spring.mail.properties.mail.smtp.starttls.enable=true
  ```

- **Usar HTTPS** (para segurança do token no link).

---

### **4. Fluxo Funcionando**
1. Usuário insere e-mail em `/forgot-password`.
2. Sistema gera um token, salva no banco e envia por e-mail.
3. Usuário clica no link (ex: `http://seusite.com/reset-password?token=ABC123`).
4. Sistema valida o token e permite redefinir a senha (`/reset-password`).

Pronto! Isso cobre o básico de um sistema de "Esqueci a senha" no Spring.

Você está certo, **precisa de DTOs** para uma API mais segura e organizada. Também há alguns ajustes necessários no código anterior. Aqui está a versão corrigida e completa:

---

### **1. DTOs Necessários**
```java
// Request para solicitar redefinição
public record ForgotPasswordRequest(String email) {}

// Request para definir nova senha
public record ResetPasswordRequest(String token, String newPassword) {}
```

---

### **2. Controller Atualizado (usando DTOs)**
```java
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class PasswordResetController {
    private final PasswordResetService passwordResetService;

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        passwordResetService.generateResetToken(request.email());
        return ResponseEntity.ok("E-mail de redefinição enviado");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok("Senha redefinida com sucesso");
    }
}
```

---

### **3. Correções no Serviço**
#### **Problemas no código anterior:**
1. **Faltou verificar se o token já existe** (evitar duplicados).
2. **Faltou tratamento de exceções específicas**.
3. **Senha deve ser codificada com `BCrypt`**.

#### **Versão corrigida:**
```java
@Service
@RequiredArgsConstructor
public class PasswordResetService {
    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;
    private final PasswordEncoder passwordEncoder;

    public void generateResetToken(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("Usuário não encontrado"));

        // Remove tokens existentes para o usuário
        tokenRepository.deleteByUser(user);

        String token = UUID.randomUUID().toString();
        PasswordResetToken resetToken = new PasswordResetToken(
            token, 
            user, 
            LocalDateTime.now().plusHours(24)
        );
        tokenRepository.save(resetToken);

        String resetLink = "http://seusite.com/reset-password?token=" + token;
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(user.getEmail());
        message.setSubject("Redefinição de Senha");
        message.setText("Clique no link: " + resetLink);
        mailSender.send(message);
    }

    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = tokenRepository.findByToken(token)
            .orElseThrow(() -> new RuntimeException("Token inválido"));

        if (resetToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Token expirado");
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(newPassword)); // Codifica a senha!
        userRepository.save(user);
        tokenRepository.delete(resetToken);
    }
}
```

---

### **4. Melhorias Adicionais**
#### **Tratamento de Exceções Customizadas**
```java
@ResponseStatus(HttpStatus.NOT_FOUND)
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String message) {
        super(message);
    }
}

// No serviço, substitua `RuntimeException` por:
throw new UserNotFoundException("Usuário não encontrado");
```

#### **Repository Atualizado**
```java
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, String> {
    Optional<PasswordResetToken> findByToken(String token);
    void deleteByUser(User user); // Novo método para limpar tokens antigos
}
```

---

### **5. Validações no DTO (Opcional)**
```java
public record ResetPasswordRequest(
    @NotBlank String token,
    @NotBlank @Size(min = 6) String newPassword
) {}
```
- Use `@Valid` no controller para ativar as validações:
  ```java
  public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request)
  ```

---

### **Por que DTOs?**
1. **Segurança**: Evita expor entidades do banco de dados diretamente na API.
2. **Controle**: Permite filtrar/validar campos recebidos (ex: tamanho mínimo da senha).
3. **Organização**: Separa claramente os dados da API da lógica interna.

---

### **Fluxo Final**
1. **Cliente envia** email para `/forgot-password` (via `ForgotPasswordRequest`).
2. **Servidor gera token**, salva no banco e envia e-mail.
3. **Cliente envia** token + nova senha para `/reset-password` (via `ResetPasswordRequest`).
4. **Servidor valida**, codifica a nova senha e atualiza o usuário.

Agora sim, o código está completo e correto! ✅
